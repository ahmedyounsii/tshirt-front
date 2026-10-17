import { Component, inject, OnInit } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import {
  CategoryChipsComponent,
  ChipItem,
} from '../../components/category-chips/category-chips.component';
import { TshirtsService } from '../../services/tshirts/tshirts.service';
import { DesignsService } from '../../services/designs/design.service';
import { CategoriesService } from '../../services/categories/categories.service';
import {
  canDeleteTshirt,
  TshirtCreator,
  TshirtModel,
} from '../../models/tshirt.model';
import { AuthService } from '../../services/auth/auth.service';
import { DesignModel } from '../../models/design.model';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { DesignSide } from '../../models/design-object.model';
import { tshirtTemplate } from '../../shared/templates';
import { environment } from '../../../environments/environment';
import { ImgPreviewerComponent } from '../../components/img-previewer/img-previewer.component';
import { EmptyComponent } from '../../components/empty/empty.component';
import { ConfirmService } from '../../services/confirm/confirm.service';

// One side of a saved tshirt: its capture and the designs placed on it
type SavedTshirtSide = {
  side: DesignSide;
  label: string;
  url: string;
  designs: DesignModel[];
};

// own: saved by an admin, other: saved by a regular user or anonymously
type CreatorFilter = 'all' | 'own' | 'other';

type SavedTshirt = Omit<TshirtModel, 'designs'> & {
  designs: DesignModel[];
  sides: SavedTshirtSide[];
  updatedAt?: string;
};

type TemplateInfo = {
  style: string;
  color: string;
  colorLabel: string;
};

// Read from the artwork file once its card is expanded
type ArtworkInfo = {
  fileName: string;
  format: string;
  width?: number;
  height?: number;
  // Bytes, when the server sends a Content-Length
  size?: number;
};

// Printable zone of the tshirts, artworks are print-ready when they cover it at PRINT_DPI
const PRINT_AREA_CM = { width: 30, height: 40 };
const PRINT_DPI = 300;
const CM_PER_INCH = 2.54;

@Component({
  selector: 'app-saved-tshirts',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    CategoryChipsComponent,
    ImgPreviewerComponent,
    EmptyComponent,
  ],
  templateUrl: './saved-tshirts.component.html',
  styleUrl: './saved-tshirts.component.scss',
})
export class SavedTshirtsComponent implements OnInit {
  router = inject(Router);
  private tshirtsService = inject(TshirtsService);
  private confirm = inject(ConfirmService);
  private designsService = inject(DesignsService);
  private categoriesService = inject(CategoriesService);
  private auth = inject(AuthService);

  baseUrl = environment.baseUrl;
  printArea = PRINT_AREA_CM;
  printDpi = PRINT_DPI;
  tshirts: SavedTshirt[] = [];
  categories: DesignCategoryModel[] = [];
  preview: string | null = null;
  loading = false;
  // Tshirt being deleted: its delete button shows a spinner meanwhile
  deletingId: string | null = null;
  filter: CreatorFilter = 'all';
  // Expanded cards, and the side each one shows
  expanded = new Set<string>();
  selectedSide = new Map<string, DesignSide>();
  artworks = new Map<string, ArtworkInfo>();

  readonly filters: { value: CreatorFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'own', label: 'Own designs' },
    { value: 'other', label: 'Other designs' },
  ];

  get filterChips(): ChipItem[] {
    return this.filters.map((f) => ({
      id: f.value,
      label: f.label,
      count: this.tshirtsOf(f.value).length,
    }));
  }

  get filteredTshirts(): SavedTshirt[] {
    return this.tshirtsOf(this.filter);
  }

  tshirtsOf(filter: CreatorFilter): SavedTshirt[] {
    if (filter === 'all') return this.tshirts;
    const wantAdmin = filter === 'own';
    return this.tshirts.filter(
      (t) => (t.createdBy?.role === 'admin') === wantAdmin,
    );
  }

  ngOnInit(): void {
    this.loading = true;
    // Designer uploads are hidden from the design list: fetch the tshirts' designs by id
    const tshirts$ = this.tshirtsService.getTshirts().pipe(
      switchMap((tshirts) => {
        const ids = uniq(tshirts.flatMap((t) => t.designs || []));
        const designs$ = ids.length
          ? this.designsService.getDesigns(ids)
          : of([] as DesignModel[]);
        return designs$.pipe(map((designs) => ({ tshirts, designs })));
      }),
    );
    forkJoin({
      data: tshirts$,
      categories: this.categoriesService.getAllCategories(),
    }).subscribe({
      next: ({ data: { tshirts, designs }, categories }) => {
        this.categories = categories;
        this.tshirts = this.resolveDesigns(tshirts, designs).sort(
          (a, b) => timeOf(b) - timeOf(a),
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load saved t-shirts', err);
        this.loading = false;
      },
    });
  }

  // "Admin" for tshirts saved by an admin, the username otherwise
  creatorLabel(creator?: TshirtCreator): string {
    if (!creator) return 'Anonymous';
    if (creator.role === 'admin') return 'Admin';
    return creator.username || creator.name;
  }

  categoryLabel(id?: string): string | null {
    return this.categories.find((c) => c._id === id)?.label || null;
  }

  // e.g. "Regular · White", from the template the tshirt was designed on
  templateInfo(tshirt: SavedTshirt): TemplateInfo | null {
    const template = tshirtTemplate.find((t) => t.id === tshirt.templateId);
    if (!template) return null;
    return {
      style: capitalize(template.style || template.type),
      color: template.color,
      colorLabel: capitalize(template.colorLabel),
    };
  }

  updatedAgo(tshirt: SavedTshirt): string {
    const time = timeOf(tshirt);
    return time ? timeAgo(time) : '';
  }

  canDelete(tshirt: Pick<TshirtModel, 'createdBy'>): boolean {
    return canDeleteTshirt(tshirt, this.auth.user());
  }

  isExpanded(tshirt: SavedTshirt): boolean {
    return !!tshirt._id && this.expanded.has(tshirt._id);
  }

  toggleExpanded(tshirt: SavedTshirt) {
    const id = tshirt._id;
    if (!id) return;
    if (!this.expanded.delete(id)) {
      this.expanded.add(id);
      this.loadArtworks(this.currentSide(tshirt));
    }
  }

  currentSide(tshirt: SavedTshirt): SavedTshirtSide {
    const side = this.selectedSide.get(tshirt._id || '');
    return tshirt.sides.find((s) => s.side === side) || tshirt.sides[0];
  }

  selectSide(tshirt: SavedTshirt, side: SavedTshirtSide) {
    if (!tshirt._id) return;
    this.selectedSide.set(tshirt._id, side.side);
    this.loadArtworks(side);
  }

  artwork(design: DesignModel): ArtworkInfo {
    return this.artworks.get(design.url) || fileInfo(design.url);
  }

  // Print-ready when the artwork covers the whole print area at PRINT_DPI
  isPrintReady(info: ArtworkInfo): boolean {
    return (
      !!info.width &&
      !!info.height &&
      info.width >= cmToPx(PRINT_AREA_CM.width) &&
      info.height >= cmToPx(PRINT_AREA_CM.height)
    );
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async deleteTshirt(tshirt: SavedTshirt) {
    const id = tshirt._id;
    if (!id || this.deletingId) return;
    const owner = this.creatorLabel(tshirt.createdBy);
    const ok = await this.confirm.confirmDelete(
      `Delete "${tshirt.label}" by ${owner}? This can't be undone.`,
      'Delete t-shirt',
    );
    if (!ok || this.deletingId) return;

    this.deletingId = id;
    this.tshirtsService.deleteTshirt(id).subscribe({
      next: () => {
        this.deletingId = null;
        this.tshirts = this.tshirts.filter((t) => t._id !== id);
      },
      error: (err) => {
        console.error('Failed to delete t-shirt', err);
        this.deletingId = null;
        alert('The t-shirt could not be deleted, please try again.');
      },
    });
  }

  // Pixel size from the image itself, file size from a HEAD request
  private loadArtworks(side: SavedTshirtSide) {
    for (const design of side.designs) {
      const url = design.url;
      if (this.artworks.has(url)) continue;
      const info = fileInfo(url);
      this.artworks.set(url, info);

      const img = new Image();
      img.onload = () =>
        this.artworks.set(url, {
          ...this.artworks.get(url)!,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      img.src = url;

      fetch(url, { method: 'HEAD' })
        .then((res) => {
          const size = Number(res.headers.get('Content-Length'));
          if (res.ok && size) {
            this.artworks.set(url, { ...this.artworks.get(url)!, size });
          }
        })
        .catch(() => {});
    }
  }

  // Tshirts only store design ids: map them to the actual designs
  private resolveDesigns(
    tshirts: TshirtModel[],
    designs: DesignModel[],
  ): SavedTshirt[] {
    const designsById = new Map(
      designs.map((d) => [d._id, { ...d, url: `${this.baseUrl}${d.url}` }]),
    );
    const resolve = (ids: string[]) =>
      uniq(ids)
        .map((id) => designsById.get(id))
        .filter((d): d is DesignModel => !!d);

    return tshirts.map((tshirt) => {
      const allDesigns = resolve(tshirt.designs || []);
      // Designs of one side, from the objects placed on it
      const sideDesigns = (side: DesignSide) =>
        resolve(
          (tshirt.objects || [])
            .filter((o) => (o.side ?? 'front') === side && o.design)
            .map((o) => o.design!),
        );
      const sides: SavedTshirtSide[] = [
        {
          side: 'front',
          label: 'Front',
          url: `${this.baseUrl}${tshirt.url}`,
          // Tshirts saved without the designer state only know their design ids
          designs: tshirt.objects?.length ? sideDesigns('front') : allDesigns,
        },
      ];
      // The back is captured even when empty: only show it when something is on it
      const backHasObjects = (tshirt.objects || []).some(
        (o) => o.side === 'back',
      );
      if (tshirt.backUrl && backHasObjects) {
        sides.push({
          side: 'back',
          label: 'Back',
          url: `${this.baseUrl}${tshirt.backUrl}`,
          designs: sideDesigns('back'),
        });
      }
      return {
        ...tshirt,
        url: sides[0].url,
        designs: allDesigns,
        sides,
      };
    });
  }
}

const uniq = <T>(items: T[]): T[] => [...new Set(items)];

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

const cmToPx = (cm: number): number =>
  Math.round((cm / CM_PER_INCH) * PRINT_DPI);

const fileInfo = (url: string): ArtworkInfo => {
  const fileName = decodeURIComponent(url.split('?')[0].split('/').pop() || 'artwork');
  const ext = fileName.includes('.') ? fileName.split('.').pop()! : '';
  return { fileName, format: ext.toUpperCase() };
};

// The backend may not send timestamps: fall back to the creation time held in the Mongo ObjectId
const timeOf = (tshirt: SavedTshirt): number => {
  const date = tshirt.updatedAt || tshirt.createdAt;
  if (date) return new Date(date).getTime();
  const seconds = parseInt(tshirt._id?.substring(0, 8) || '', 16);
  return Number.isNaN(seconds) ? 0 : seconds * 1000;
};

const timeAgo = (time: number): string => {
  const seconds = Math.max(0, (Date.now() - time) / 1000);
  const units: [string, number][] = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};
