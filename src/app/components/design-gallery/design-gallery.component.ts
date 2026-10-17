import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { CarouselModule, CarouselResponsiveOptions } from 'primeng/carousel';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TshirtsService } from '../../services/tshirts/tshirts.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { TshirtModel } from '../../models/tshirt.model';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { tshirtTemplate } from '../../shared/templates';
import { environment } from '../../../environments/environment';
import {
  ImgPreviewerComponent,
  PreviewView,
} from '../img-previewer/img-previewer.component';
import { EmptyComponent } from '../empty/empty.component';
import {
  CategoryChipsComponent,
  ChipItem,
} from '../category-chips/category-chips.component';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { DesignsObjectService } from '../../services/selected-design.service';

type TemplateInfo = {
  style: string;
  color: string;
  colorLabel: string;
};

const ALL = 'all';
// Same id as the server's filter for tshirts without a known category
const OTHER = 'other';
const FAVORITES_KEY = 'design-gallery-favorites';

@Component({
  selector: 'app-design-gallery',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    ButtonModule,
    CarouselModule,
    SkeletonModule,
    PaginatorModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ImgPreviewerComponent,
    EmptyComponent,
    CategoryChipsComponent,
  ],
  templateUrl: './design-gallery.component.html',
  styleUrl: './design-gallery.component.scss',
  // State is in signals (or set from template events), so OnPush is enough
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignGalleryComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private tshirtsService = inject(TshirtsService);
  private confirm = inject(ConfirmService);
  private categoriesService = inject(CategoriesService);
  private designsObjectService = inject(DesignsObjectService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Only the logged in user's own tshirts (the "My designs" page)
  @Input() mine = false;
  @Input() pageSizes = [12, 24, 48];
  // Home widget: one scrollable row of the first tshirts, no paginator
  @Input() carousel = false;
  @Input() carouselSize = 12;
  // Cards per slide below each screen width (4 above the widest)
  carouselBreakpoints: CarouselResponsiveOptions[] = [
    { breakpoint: '1280px', numVisible: 3, numScroll: 1 },
    { breakpoint: '960px', numVisible: 2, numScroll: 1 },
    { breakpoint: '640px', numVisible: 1, numScroll: 1 },
  ];

  @Output() addToBag = new EventEmitter<TshirtModel>();

  baseUrl = environment.baseUrl;
  // Front and back captures of the previewed tshirt
  preview: { front: PreviewView; back: PreviewView | null } | null = null;
  // Starts true so the server render shows the skeleton, not the empty state
  loading = signal(true);
  // Tshirt being deleted: its delete button shows a spinner meanwhile
  deletingId = signal<string | null>(null);
  // Tshirt being loaded in the designer (its images are fetched first)
  editingId = signal<string | null>(null);
  // Cards switched to their back with the flip button
  flipped = signal<Set<string>>(new Set());

  // Current page only: paging, category filter and search are done by the server
  tshirts = signal<TshirtModel[]>([]);
  categories = signal<DesignCategoryModel[]>([]);
  favorites = signal<Set<string>>(new Set());
  // Tshirts per category for the current search, "all" being the total
  counts = signal<Record<string, number>>({});
  // Tshirts matching the search and category (all pages)
  count = signal(0);
  page = signal(1);
  size = signal(12);

  search = signal('');
  selectedCategory = signal(ALL);

  // Total without search nor category: tells "nothing saved yet" from "no match"
  hasTshirts = signal(false);

  // "All", every category (even empty ones), then "Other" when some tshirts have no known category
  filters = computed<ChipItem[]>(() => {
    const counts = this.counts();
    const filters: ChipItem[] = this.categories().map((c) => ({
      id: c._id,
      label: c.label,
      count: counts[c._id] || 0,
    }));
    if (counts[OTHER] || this.selectedCategory() === OTHER) {
      filters.push({ id: OTHER, label: 'Other', count: counts[OTHER] || 0 });
    }
    return [{ id: ALL, label: 'All', count: counts['all'] || 0 }, ...filters];
  });

  private request?: Subscription;

  ngOnInit(): void {
    this.size.set(this.carousel ? this.carouselSize : this.pageSizes[0]);
    this.favorites.set(this.loadFavorites());
    // The API is only reachable from the browser: fetching on the server rendered
    // "No saved t-shirts yet", which stayed in the DOM next to the hydrated grid
    if (!this.isBrowser) return;
    this.categoriesService.getAllCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: (err) => console.error('Failed to load categories', err),
    });
    this.reload();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  // Fetches the given page with the current filters
  reload(page = this.page()) {
    this.page.set(page);
    this.loading.set(true);
    const category = this.selectedCategory();
    // A newer filter or page wins over a response still on its way
    this.request?.unsubscribe();
    this.request = this.tshirtsService
      .getTshirtsPage({
        mine: this.mine,
        page,
        size: this.size(),
        category: category === ALL ? undefined : category,
        search: this.search(),
      })
      .subscribe({
        next: (data) => {
          this.tshirts.set(
            data.items.map((t) => ({
              ...t,
              url: `${this.baseUrl}${t.url}`,
              backUrl: t.backUrl ? `${this.baseUrl}${t.backUrl}` : undefined,
            })),
          );
          this.count.set(data.count);
          this.counts.set(data.counts || {});
          if (!this.search().trim())
            this.hasTshirts.set((data.counts?.['all'] || 0) > 0);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load t-shirts', err);
          this.loading.set(false);
        },
      });
  }

  selectCategory(id: string) {
    this.selectedCategory.set(id);
    this.reload(1);
  }

  // Like the designs gallery: wait for 3 characters, or a cleared field
  onSearch(value: string) {
    this.search.set(value);
    const term = value.trim();
    if (term.length > 2 || term.length === 0) this.reload(1);
  }

  onPageChange(event: PaginatorState) {
    this.size.set(event.rows ?? this.size());
    this.reload((event.page ?? 0) + 1);
  }

  openPreview(tshirt: TshirtModel) {
    // The capture is already composed (template + designs): it's its own 3D texture
    const view = (url: string): PreviewView => ({
      preview: url,
      templateUrl: url,
      designs: [],
      printArea: null,
    });
    this.preview = {
      front: view(tshirt.url),
      back: tshirt.backUrl ? view(tshirt.backUrl) : null,
    };
  }

  isFlipped(tshirt: TshirtModel): boolean {
    return !!tshirt._id && this.flipped().has(tshirt._id);
  }

  setFlipped(tshirt: TshirtModel, flipped: boolean) {
    if (!tshirt._id) return;
    const next = new Set(this.flipped());
    if (flipped) next.add(tshirt._id);
    else next.delete(tshirt._id);
    this.flipped.set(next);
  }

  categoryLabel(id?: string): string {
    if (!id || id === OTHER) return 'Other';
    return this.categories().find((c) => c._id === id)?.label || 'Other';
  }

  // e.g. "Regular · White", from the template the tshirt was designed on
  templateInfo(tshirt: TshirtModel): TemplateInfo | null {
    const template = tshirtTemplate.find((t) => t.id === tshirt.templateId);
    if (!template) return null;
    return {
      style: this.capitalize(template.style || template.type),
      color: template.color,
      colorLabel: this.capitalize(template.colorLabel),
    };
  }

  // Who designed the tshirt; hidden for admin-made ones (the shop's own designs)
  creatorName(tshirt: TshirtModel): string | null {
    const creator = tshirt.createdBy;
    if (!creator || creator.role === 'admin') return null;
    if (creator.username) return `@${creator.username}`;
    return creator.name || null;
  }

  // Only on "My designs": opens the tshirt in the designer in edit mode (update it or save as new)
  async editTshirt(tshirt: TshirtModel) {
    console.log(tshirt);

    if (this.editingId()) return;
    const ok = await this.confirm.ask({
      header: 'Edit t-shirt',
      message: 'This replaces the design currently in the designer.',
      acceptLabel: 'Edit',
      acceptIcon: 'pi pi-pencil',
    });
    if (!ok) return;

    this.editingId.set(tshirt._id ?? null);
    try {
      await this.designsObjectService.loadTshirt(tshirt);
      this.router.navigate(['/designer']);
    } finally {
      this.editingId.set(null);
    }
  }

  // Only on "My designs": users delete their own tshirts (the server checks it too)
  async deleteTshirt(tshirt: TshirtModel) {
    const id = tshirt._id;
    if (!id || this.deletingId()) return;
    const ok = await this.confirm.confirmDelete(
      `Delete "${tshirt.label}"? This can't be undone.`,
      'Delete t-shirt',
    );
    if (!ok || this.deletingId()) return;

    this.deletingId.set(id);
    this.tshirtsService.deleteTshirt(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        if (this.isFavorite(tshirt)) this.toggleFavorite(tshirt);
        // Step back a page if we just removed the last tshirt on it
        const page =
          this.tshirts().length === 1 && this.page() > 1
            ? this.page() - 1
            : this.page();
        this.reload(page);
      },
      error: (err) => {
        console.error('Failed to delete t-shirt', err);
        this.deletingId.set(null);
        alert('The t-shirt could not be deleted, please try again.');
      },
    });
  }

  isFavorite(tshirt: TshirtModel): boolean {
    return !!tshirt._id && this.favorites().has(tshirt._id);
  }

  toggleFavorite(tshirt: TshirtModel) {
    if (!tshirt._id) return;
    const favorites = new Set(this.favorites());
    if (!favorites.delete(tshirt._id)) favorites.add(tshirt._id);
    this.favorites.set(favorites);
    this.saveFavorites(favorites);
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  // Favorites are a per-browser convenience, not stored on the backend
  private loadFavorites(): Set<string> {
    if (!this.isBrowser) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }

  private saveFavorites(favorites: Set<string>) {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    } catch {}
  }
}
