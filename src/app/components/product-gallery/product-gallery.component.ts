import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { CurrencyPipe, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { Popover, PopoverModule } from 'primeng/popover';
import { InputNumberModule } from 'primeng/inputnumber';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ProductsService } from '../../services/products/products.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { PRODUCT_TYPES, ProductModel, ProductType } from '../../models/product.model';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { tshirtTemplate } from '../../shared/templates';
import { environment } from '../../../environments/environment';
import {
  ImgPreviewerComponent,
  ProductPreview,
  productPreview,
} from '../img-previewer/img-previewer.component';
import { EmptyComponent } from '../empty/empty.component';
import {
  CategoryChipsComponent,
  ChipItem,
} from '../category-chips/category-chips.component';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { DesignsObjectService } from '../../services/selected-design.service';
import { CartService } from '../../services/cart/cart.service';
import { AuthService } from '../../services/auth/auth.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type TemplateInfo = {
  style: string;
  color: string;
  colorLabel: string;
};

const ALL = 'all';
// Same id as the server's filter for products without a known category
const OTHER = 'other';
const FAVORITES_KEY = 'design-gallery-favorites';

export type GallerySort = 'featured' | 'newest' | 'priceAsc' | 'priceDesc' | 'name';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    NgTemplateOutlet,
    CurrencyPipe,
    ButtonModule,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    PopoverModule,
    InputNumberModule,
    ImgPreviewerComponent,
    EmptyComponent,
    CategoryChipsComponent,
  ],
  templateUrl: './product-gallery.component.html',
  styleUrl: './product-gallery.component.scss',
  // State is in signals (or set from template events), so OnPush is enough
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGalleryComponent implements OnInit, OnDestroy {
  router = inject(Router);
  // "Shop now" opens the size picker of the cart
  cart = inject(CartService);
  private productsService = inject(ProductsService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private categoriesService = inject(CategoriesService);
  private designsObjectService = inject(DesignsObjectService);
  // Only admins set prices: other users' products are priced from the price list
  isAdmin = inject(AuthService).isAdmin;
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Only the logged in user's own products (the "My designs" page)
  @Input() mine = false;
  // Products fetched on first load, then on each "Show more"
  @Input() pageSize = 10;
  // Store page: shop wording, sorting and a richer empty state
  @Input() storefront = false;

  baseUrl = environment.baseUrl;
  // Front and back captures of the previewed product
  preview: ProductPreview | null = null;
  // Starts true so the server render shows the skeleton, not the empty state
  loading = signal(true);
  // "Show more" request in flight: the loaded products stay visible
  loadingMore = signal(false);
  // Product being deleted: its delete button shows a spinner meanwhile
  deletingId = signal<string | null>(null);
  // Product being loaded in the designer (its images are fetched first)
  editingId = signal<string | null>(null);
  // Only on "My designs": the product whose actions popover (edit, price, delete) is open
  @ViewChild('actionsPopover') actionsPopover?: Popover;
  actionsProduct = signal<ProductModel | null>(null);
  // The popover shows the price form instead of the actions list
  priceMode = signal(false);
  // Custom price typed in the form, null goes back to the price list
  priceDraft: number | null = null;
  savingPrice = signal(false);
  // Cards switched to their back with the flip button
  flipped = signal<Set<string>>(new Set());

  // Every chunk loaded so far: category filter and search are done by the server
  products = signal<ProductModel[]>([]);
  categories = signal<DesignCategoryModel[]>([]);
  favorites = signal<Set<string>>(new Set());
  // Products per category for the current search, "all" being the total
  counts = signal<Record<string, number>>({});
  // Products matching the search and category (all pages)
  count = signal(0);
  // Last page loaded, so products shown = page * pageSize (at most)
  page = signal(1);
  hasMore = computed(() => this.products().length < this.count());

  search = signal('');
  sort = signal<GallerySort>('featured');
  readonly sorts: GallerySort[] = ['featured', 'newest', 'priceAsc', 'priceDesc', 'name'];

  // Sorting is applied to the loaded products only, the server keeps its own order
  sortedProducts = computed(() => {
    const products = this.products();
    const price = (t: ProductModel, missing: number) => t.price ?? missing;
    const date = (t: ProductModel) => (t.createdAt ? Date.parse(t.createdAt) : 0);
    switch (this.sort()) {
      case 'newest':
        return [...products].sort((a, b) => date(b) - date(a));
      case 'priceAsc':
        return [...products].sort((a, b) => price(a, Infinity) - price(b, Infinity));
      case 'priceDesc':
        return [...products].sort((a, b) => price(b, -Infinity) - price(a, -Infinity));
      case 'name':
        return [...products].sort((a, b) => a.label.localeCompare(b.label));
      default:
        return products;
    }
  });
  selectedCategory = signal(ALL);
  selectedType = signal<ProductType | typeof ALL>(ALL);

  // "All", then one chip per product type (t-shirts, sweatshirts)
  readonly typeFilters: ChipItem[] = [
    { id: ALL, label: 'common.all' },
    ...PRODUCT_TYPES.map((type) => ({ id: type, label: `gallery.types.${type}` })),
  ];

  // Total without search nor category: tells "nothing saved yet" from "no match"
  hasProducts = signal(false);

  // "All", every category (even empty ones), then "Other" when some products have no known category
  filters = computed<ChipItem[]>(() => {
    const counts = this.counts();
    const filters: ChipItem[] = this.categories().map((c) => ({
      id: c._id,
      label: c.label,
      count: counts[c._id] || 0,
    }));
    if (counts[OTHER] || this.selectedCategory() === OTHER) {
      filters.push({ id: OTHER, label: 'common.other', count: counts[OTHER] || 0 });
    }
    return [{ id: ALL, label: 'common.all', count: counts['all'] || 0 }, ...filters];
  });

  private request?: Subscription;

  ngOnInit(): void {
    this.favorites.set(this.loadFavorites());
    // The API is only reachable from the browser: fetching on the server rendered
    // "No saved products yet", which stayed in the DOM next to the hydrated grid
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

  // Starts over from the first chunk with the current filters
  reload() {
    this.page.set(1);
    this.loading.set(true);
    this.fetch(1, this.pageSize, (items) => this.products.set(items));
  }

  loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const next = this.page() + 1;
    this.fetch(next, this.pageSize, (items) => {
      this.page.set(next);
      this.products.update((products) => [...products, ...items]);
    });
  }

  // Fetches again everything already shown in one request, keeping the list length
  private refresh() {
    this.fetch(1, this.page() * this.pageSize, (items) => this.products.set(items));
  }

  private fetch(page: number, size: number, apply: (items: ProductModel[]) => void) {
    const category = this.selectedCategory();
    const type = this.selectedType();
    // A newer filter or chunk wins over a response still on its way
    this.request?.unsubscribe();
    this.request = this.productsService
      .getProductsPage({
        mine: this.mine,
        page,
        size,
        type: type === ALL ? undefined : type,
        category: category === ALL ? undefined : category,
        search: this.search(),
      })
      .subscribe({
        next: (data) => {
          apply(
            data.items.map((t) => ({
              ...t,
              url: `${this.baseUrl}${t.url}`,
              backUrl: t.backUrl ? `${this.baseUrl}${t.backUrl}` : undefined,
            })),
          );
          this.count.set(data.count);
          this.counts.set(data.counts || {});
          if (!this.search().trim())
            this.hasProducts.set((data.counts?.['all'] || 0) > 0);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (err) => {
          console.error('Failed to load products', err);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  selectCategory(id: string) {
    this.selectedCategory.set(id);
    this.reload();
  }

  selectType(id: string) {
    this.selectedType.set(id as ProductType | typeof ALL);
    this.reload();
  }

  // Like the designs gallery: wait for 3 characters, or a cleared field
  onSearch(value: string) {
    this.search.set(value);
    const term = value.trim();
    if (term.length > 2 || term.length === 0) this.reload();
  }

  openPreview(product: ProductModel) {
    this.preview = productPreview(product);
  }

  isFlipped(product: ProductModel): boolean {
    return !!product._id && this.flipped().has(product._id);
  }

  setFlipped(product: ProductModel, flipped: boolean) {
    if (!product._id) return;
    const next = new Set(this.flipped());
    if (flipped) next.add(product._id);
    else next.delete(product._id);
    this.flipped.set(next);
  }

  categoryLabel(id?: string): string {
    if (!id || id === OTHER) return 'common.other';
    return (
      this.categories().find((c) => c._id === id)?.label || 'common.other'
    );
  }

  // Translation keys of e.g. "Regular · White", from the template the product was designed on
  templateInfo(product: ProductModel): TemplateInfo | null {
    const template = tshirtTemplate.find((t) => t.id === product.templateId);
    if (!template) return null;
    return {
      style: `templates.styles.${template.style || template.type}`,
      color: template.color,
      colorLabel: `templates.colors.${template.colorLabel}`,
    };
  }

  // Who designed the product; hidden for admin-made ones (the shop's own designs)
  creatorName(product: ProductModel): string | null {
    const creator = product.createdBy;
    if (!creator || creator.role === 'admin') return null;
    if (creator.username) return `@${creator.username}`;
    return creator.name || null;
  }

  // Only on "My designs": opens the actions popover of this product, at its "..." button
  openActions(event: Event, product: ProductModel) {
    this.actionsProduct.set(product);
    this.priceMode.set(false);
    this.priceDraft = product.customPrice ?? null;
    this.actionsPopover?.toggle(event);
  }

  // Closes the popover, then runs one of its actions on its product
  runAction(action: 'edit' | 'delete') {
    const product = this.actionsProduct();
    this.actionsPopover?.hide();
    if (!product) return;
    if (action === 'edit') this.editProduct(product);
    else this.deleteProduct(product);
  }

  // Only on "My designs", admins only: saves the custom price typed in the popover
  // (empty goes back to the price list)
  savePrice() {
    const id = this.actionsProduct()?._id;
    if (!id || this.savingPrice()) return;
    const price = this.priceDraft;
    this.savingPrice.set(true);
    this.productsService.updatePrice(id, price).subscribe({
      next: (saved) => {
        this.savingPrice.set(false);
        this.products.update((products) =>
          products.map((t) =>
            t._id === id
              ? { ...t, price: saved?.price ?? null, customPrice: saved?.customPrice ?? null }
              : t,
          ),
        );
        this.actionsPopover?.hide();
      },
      error: (err) => {
        console.error('Failed to update the price', err);
        this.savingPrice.set(false);
        alert(this.translate.instant('gallery.priceFailed'));
      },
    });
  }

  // Only on "My designs": opens the product in the designer in edit mode (update it or save as new)
  async editProduct(product: ProductModel) {
    console.log(product);

    if (this.editingId()) return;
    const ok = await this.confirm.ask({
      header: this.translate.instant('gallery.editHeader'),
      message: this.translate.instant('gallery.editMessage'),
      acceptLabel: this.translate.instant('common.edit'),
      acceptIcon: 'pi pi-pencil',
    });
    if (!ok) return;

    this.editingId.set(product._id ?? null);
    try {
      await this.designsObjectService.loadProduct(product);
      this.router.navigate(['/designer']);
    } finally {
      this.editingId.set(null);
    }
  }

  // Only on "My designs": users delete their own products (the server checks it too)
  async deleteProduct(product: ProductModel) {
    const id = product._id;
    if (!id || this.deletingId()) return;
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('gallery.deleteMessage', { label: product.label }),
      this.translate.instant('gallery.deleteHeader'),
    );
    if (!ok || this.deletingId()) return;

    this.deletingId.set(id);
    this.productsService.deleteProduct(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        if (this.isFavorite(product)) this.toggleFavorite(product);
        // Drop it right away, then refetch so the list fills back up
        this.products.update((products) => products.filter((t) => t._id !== id));
        this.count.update((count) => Math.max(0, count - 1));
        this.refresh();
      },
      error: (err) => {
        console.error('Failed to delete product', err);
        this.deletingId.set(null);
        alert(this.translate.instant('gallery.deleteFailed'));
      },
    });
  }

  isFavorite(product: ProductModel): boolean {
    return !!product._id && this.favorites().has(product._id);
  }

  toggleFavorite(product: ProductModel) {
    if (!product._id) return;
    const favorites = new Set(this.favorites());
    if (!favorites.delete(product._id)) favorites.add(product._id);
    this.favorites.set(favorites);
    this.saveFavorites(favorites);
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
