import { Component, inject, OnInit } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import {
  CategoryChipsComponent,
  ChipItem,
} from '../../components/category-chips/category-chips.component';
import { ProductsService } from '../../services/products/products.service';
import { DesignsService } from '../../services/designs/design.service';
import { CategoriesService } from '../../services/categories/categories.service';
import {
  canDeleteProduct,
  ProductCreator,
  ProductModel,
} from '../../models/product.model';
import { AuthService } from '../../services/auth/auth.service';
import { DesignModel } from '../../models/design.model';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { DesignSide } from '../../models/design-object.model';
import { TemplatesService } from '../../services/templates/templates.service';
import { cmToPx, PRINT_AREA_CM, PRINT_DPI } from '../../shared/print.config';
import { environment } from '../../../environments/environment';
import { ImgPreviewerComponent } from '../../components/img-previewer/img-previewer.component';
import { EmptyComponent } from '../../components/empty/empty.component';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { PreviewService } from '../../services/preview/preview.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TagComponent } from '../../components/tag/tag.component';

// One side of a saved product: its capture and the designs placed on it
type SavedProductSide = {
  side: DesignSide;
  label: string;
  url: string;
  designs: DesignModel[];
};

// own: saved by an admin, other: saved by a regular user or anonymously
type CreatorFilter = 'all' | 'own' | 'other';

type SavedProduct = Omit<ProductModel, 'designs'> & {
  designs: DesignModel[];
  sides: SavedProductSide[];
  updatedAt?: string;
};

type TemplateInfo = {
  style: string;
  color: string;
  colorLabel: string;
};

// Read from the artwork file once its row is expanded
type ArtworkInfo = {
  fileName: string;
  format: string;
  width?: number;
  height?: number;
  // Bytes, when the server sends a Content-Length
  size?: number;
};

@Component({
    selector: 'app-saved-products',
    imports: [
        TagComponent,
        TranslatePipe,
        ButtonModule,
        SkeletonModule,
        CategoryChipsComponent,
        ImgPreviewerComponent,
        EmptyComponent,
    ],
    templateUrl: './saved-products.component.html',
    styleUrl: './saved-products.component.scss'
})
export class SavedProductsComponent implements OnInit {
  router = inject(Router);
  private productsService = inject(ProductsService);
  private confirm = inject(ConfirmService);
  private designsService = inject(DesignsService);
  private categoriesService = inject(CategoriesService);
  private templatesService = inject(TemplatesService);
  private auth = inject(AuthService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private previewer = inject(PreviewService);

  baseUrl = environment.baseUrl;
  printArea = PRINT_AREA_CM;
  printDpi = PRINT_DPI;
  products: SavedProduct[] = [];
  categories: DesignCategoryModel[] = [];
  // Enlarged artwork
  preview: string | null = null;
  loading = false;
  // Product being deleted: its delete button shows a spinner meanwhile
  deletingId: string | null = null;
  filter: CreatorFilter = 'all';
  // Expanded rows, and the side each one shows
  expanded = new Set<string>();
  selectedSide = new Map<string, DesignSide>();
  artworks = new Map<string, ArtworkInfo>();

  readonly filters: { value: CreatorFilter; label: string }[] = [
    { value: 'all', label: 'common.all' },
    { value: 'own', label: 'saved.ownDesigns' },
    { value: 'other', label: 'saved.otherDesigns' },
  ];

  get filterChips(): ChipItem[] {
    return this.filters.map((f) => ({
      id: f.value,
      label: f.label,
      // Hidden until the products are loaded
      count: this.loading ? undefined : this.productsOf(f.value).length,
    }));
  }

  get filteredProducts(): SavedProduct[] {
    return this.productsOf(this.filter);
  }

  productsOf(filter: CreatorFilter): SavedProduct[] {
    if (filter === 'all') return this.products;
    const wantAdmin = filter === 'own';
    return this.products.filter(
      (t) => (t.createdBy?.role === 'admin') === wantAdmin,
    );
  }

  ngOnInit(): void {
    this.loading = true;
    // Designer uploads are hidden from the design list: fetch the products' designs by id
    const products$ = this.productsService.getProducts().pipe(
      switchMap((products) => {
        const ids = uniq(products.flatMap((t) => t.designs || []));
        const designs$ = ids.length
          ? this.designsService.getDesigns(ids)
          : of([] as DesignModel[]);
        return designs$.pipe(map((designs) => ({ products, designs })));
      }),
    );
    forkJoin({
      data: products$,
      categories: this.categoriesService.getAllCategories(),
    }).subscribe({
      next: ({ data: { products, designs }, categories }) => {
        this.categories = categories;
        this.products = this.resolveDesigns(products, designs).sort(
          (a, b) => timeOf(b) - timeOf(a),
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load saved products', err);
        this.loading = false;
      },
    });
  }

  // "Admin" for products saved by an admin, the username otherwise
  creatorLabel(creator?: ProductCreator): string {
    if (!creator) return this.translate.instant('saved.anonymous');
    if (creator.role === 'admin') return this.translate.instant('saved.admin');
    return creator.username || creator.name;
  }

  categoryLabel(id?: string): string | null {
    return this.categories.find((c) => c._id === id)?.label || null;
  }

  // Translation keys of e.g. "Regular · White", from the template the product was designed on
  templateInfo(product: SavedProduct): TemplateInfo | null {
    const template = this.templatesService.byId(product.templateId) ?? product.template;
    if (!template) return null;
    return {
      style: `templates.styles.${template.style || template.type}`,
      color: template.color,
      colorLabel: `templates.colors.${template.colorLabel}`,
    };
  }

  updatedAgo(product: SavedProduct): string {
    const time = timeOf(product);
    if (!time) return '';
    return timeAgo(time, this.language.current()) || this.translate.instant('saved.justNow');
  }

  canDelete(product: Pick<ProductModel, 'createdBy'>): boolean {
    return canDeleteProduct(product, this.auth.user());
  }

  isExpanded(product: SavedProduct): boolean {
    return !!product._id && this.expanded.has(product._id);
  }

  toggleExpanded(product: SavedProduct) {
    const id = product._id;
    if (!id) return;
    if (!this.expanded.delete(id)) {
      this.expanded.add(id);
      this.loadArtworks(this.currentSide(product));
    }
  }

  currentSide(product: SavedProduct): SavedProductSide {
    const side = this.selectedSide.get(product._id || '');
    return product.sides.find((s) => s.side === side) || product.sides[0];
  }

  selectSide(product: SavedProduct, side: SavedProductSide) {
    if (!product._id) return;
    this.selectedSide.set(product._id, side.side);
    this.loadArtworks(side);
  }

  // Sides hold the absolute capture urls; the back only exists when something is on it
  previewSide(product: SavedProduct, side: SavedProductSide) {
    const back = product.sides.find((s) => s.side === 'back');
    this.previewer.open({ ...product, backUrl: back?.url ?? null }, side.side);
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

  async deleteProduct(product: SavedProduct) {
    const id = product._id;
    if (!id || this.deletingId) return;
    const owner = this.creatorLabel(product.createdBy);
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('saved.deleteMessage', {
        label: product.label,
        owner,
      }),
      this.translate.instant('gallery.deleteHeader'),
    );
    if (!ok || this.deletingId) return;

    this.deletingId = id;
    this.productsService.deleteProduct(id).subscribe({
      next: () => {
        this.deletingId = null;
        this.products = this.products.filter((t) => t._id !== id);
      },
      error: (err) => {
        console.error('Failed to delete product', err);
        this.deletingId = null;
        alert(this.translate.instant('gallery.deleteFailed'));
      },
    });
  }

  // Pixel size from the image itself, file size from a HEAD request
  private loadArtworks(side: SavedProductSide) {
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

  // Products only store design ids: map them to the actual designs
  private resolveDesigns(
    products: ProductModel[],
    designs: DesignModel[],
  ): SavedProduct[] {
    const designsById = new Map(
      designs.map((d) => [d._id, { ...d, url: `${this.baseUrl}${d.url}` }]),
    );
    const resolve = (ids: string[]) =>
      uniq(ids)
        .map((id) => designsById.get(id))
        .filter((d): d is DesignModel => !!d);

    return products.map((product) => {
      const allDesigns = resolve(product.designs || []);
      // Designs of one side, from the objects placed on it
      const sideDesigns = (side: DesignSide) =>
        resolve(
          (product.objects || [])
            .filter((o) => (o.side ?? 'front') === side && o.design)
            .map((o) => o.design!),
        );
      const sides: SavedProductSide[] = [
        {
          side: 'front',
          label: 'common.front',
          url: `${this.baseUrl}${product.url}`,
          // Products saved without the designer state only know their design ids
          designs: product.objects?.length ? sideDesigns('front') : allDesigns,
        },
      ];
      // The back is captured even when empty: only show it when something is on it
      const backHasObjects = (product.objects || []).some(
        (o) => o.side === 'back',
      );
      if (product.backUrl && backHasObjects) {
        sides.push({
          side: 'back',
          label: 'common.back',
          url: `${this.baseUrl}${product.backUrl}`,
          designs: sideDesigns('back'),
        });
      }
      return {
        ...product,
        url: sides[0].url,
        designs: allDesigns,
        sides,
      };
    });
  }
}

const uniq = <T>(items: T[]): T[] => [...new Set(items)];

const fileInfo = (url: string): ArtworkInfo => {
  const fileName = decodeURIComponent(url.split('?')[0].split('/').pop() || 'artwork');
  const ext = fileName.includes('.') ? fileName.split('.').pop()! : '';
  return { fileName, format: ext.toUpperCase() };
};

// The backend may not send timestamps: fall back to the creation time held in the Mongo ObjectId
const timeOf = (product: SavedProduct): number => {
  const date = product.updatedAt || product.createdAt;
  if (date) return new Date(date).getTime();
  const seconds = parseInt(product._id?.substring(0, 8) || '', 16);
  return Number.isNaN(seconds) ? 0 : seconds * 1000;
};

// "3 days ago" in the UI language, empty under a minute
const timeAgo = (time: number, lang: string): string => {
  const seconds = Math.max(0, (Date.now() - time) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) {
      return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-n, unit);
    }
  }
  return '';
};
