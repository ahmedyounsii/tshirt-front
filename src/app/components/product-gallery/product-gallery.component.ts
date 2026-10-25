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
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { PricePipe } from '../../shared/price.pipe';
import { CURRENCY } from '../../shared/currency.config';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { TemplatesService } from '../../services/templates/templates.service';
import { TemplateImagePipe } from '../../shared/template-image.pipe';
import { environment } from '../../../environments/environment';
import { PreviewService } from '../../services/preview/preview.service';
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
import { TagComponent } from '../tag/tag.component';
import { creatorLink } from '../../models/user.model';
import { ProductDetailsDialogComponent } from '../product-details-dialog/product-details-dialog.component';

type TemplateInfo = {
  style: string;
  color: string;
  colorLabel: string;
};

const ALL = 'all';
const FAVORITES_KEY = 'design-gallery-favorites';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [
    TemplateImagePipe,
    TagComponent,
    RouterLink,
    TranslatePipe,
    FormsModule,
    NgTemplateOutlet,
    PricePipe,
    ButtonModule,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    PopoverModule,
    InputNumberModule,
    EmptyComponent,
    CategoryChipsComponent,
    ProductDetailsDialogComponent,
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
  private templatesService = inject(TemplatesService);
  private designsObjectService = inject(DesignsObjectService);
  private previewer = inject(PreviewService);
  // Only admins set prices: other users' products are priced from the price list
  private auth = inject(AuthService);
  isAdmin = this.auth.isAdmin;
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Empty store art: a dark tee behind a light one, from the shop's templates
  readonly emptyArt = computed(() => {
    const templates = this.templatesService.templates();
    const thumb = (t?: (typeof templates)[number]) => t?.frontImg ?? null;
    const dark = templates.find((t) => t.colorLabel.includes('black'));
    const light = templates.find((t) => t !== dark && !t.colorLabel.includes('black'));
    return { dark: thumb(dark), light: thumb(light ?? templates[0]) };
  });

  // Only the logged in user's own products (the "My designs" page)
  @Input() mine = false;
  // Products fetched on first load, then on each "Show more"
  @Input() pageSize = 10;
  // Store page: shop wording, sorting and a richer empty state
  @Input() storefront = false;
  // Only the products of this collection (id): its page holds the heading
  @Input() collection: string | null = null;
  // Only the products of this user (id): their public profile page holds the heading
  @Input() creator: string | null = null;

  baseUrl = environment.baseUrl;
  readonly currency = CURRENCY;
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
  // Only on "My designs": the product whose name and category dialog is open
  detailsProduct = signal<ProductModel | null>(null);
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
  selectedCategory = signal(ALL);
  selectedType = signal<ProductType | typeof ALL>(ALL);

  // "All", then one chip per product type (t-shirts, sweatshirts)
  readonly typeFilters: ChipItem[] = [
    { id: ALL, label: 'common.all' },
    ...PRODUCT_TYPES.map((type) => ({ id: type, label: `gallery.types.${type}` })),
  ];

  // Total without search nor category: tells "nothing saved yet" from "no match"
  hasProducts = signal(false);

  // "All", then every category (even empty ones); products without one only show under "All"
  filters = computed<ChipItem[]>(() => {
    const counts = this.counts();
    const filters: ChipItem[] = this.categories().map((c) => ({
      id: c._id,
      label: c.label,
      count: counts[c._id] || 0,
    }));
    return [{ id: ALL, label: 'common.all', count: counts['all'] || 0 }, ...filters];
  });

  private request?: Subscription;

  ngOnInit(): void {
    this.favorites.set(this.loadFavorites());
    // The API is only reachable from the browser: fetching on the server rendered
    // "No saved products yet", which stayed in the DOM next to the hydrated grid
    if (!this.isBrowser) return;
    // Collections show no category chips, only the card tags need the labels
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
        collection: this.collection ?? undefined,
        creator: this.creator ?? undefined,
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
          // Counts follow the search and type: a filter with no match must not hide the chips
          if (!this.search().trim() && type === ALL)
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
    this.previewer.open(product);
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

  // Label of the card's category tag; null for missing or deleted ones, which show no tag
  categoryLabel(id?: string): string | null {
    if (!id) return null;
    return this.categories().find((c) => c._id === id)?.label || null;
  }

  // Translation keys of e.g. "Regular · White", from the template the product was designed on
  templateInfo(product: ProductModel): TemplateInfo | null {
    const template = this.templatesService.byId(product.templateId) ?? product.template;
    if (!template) return null;
    return {
      style: `templates.styles.${template.style || template.type}`,
      color: template.color,
      colorLabel: `templates.colors.${template.colorLabel}`,
    };
  }

  // Who designed the product; hidden for admin-made ones (the shop's own designs)
  // and on the creator's own profile page
  creatorName(product: ProductModel): string | null {
    const creator = product.createdBy;
    if (!creator || creator.role === 'admin' || this.creator) return null;
    if (creator.username) return `@${creator.username}`;
    return creator.name || null;
  }

  // Public profile of the product's creator, opened from their name on the card;
  // the user's own profile page for their own products
  creatorLink(product: ProductModel): string[] | null {
    const creator = product.createdBy;
    if (!creator) return null;
    if (creator._id === this.auth.user()?._id) return ['/profile'];
    return creatorLink(creator);
  }

  // Only on "My designs": opens the actions popover of this product, at its "..." button
  openActions(event: Event, product: ProductModel) {
    this.actionsProduct.set(product);
    this.priceMode.set(false);
    this.priceDraft = product.customPrice ?? null;
    this.actionsPopover?.toggle(event);
  }

  // Closes the popover, then runs one of its actions on its product
  runAction(action: 'details' | 'redesign' | 'delete') {
    const product = this.actionsProduct();
    this.actionsPopover?.hide();
    if (!product) return;
    if (action === 'details') this.detailsProduct.set(product);
    else if (action === 'redesign') this.editProduct(product);
    else this.deleteProduct(product);
  }

  // Keeps the card's images (prefixed with the base url) and swaps in the new name and category
  onDetailsSaved(saved: ProductModel) {
    this.products.update((products) =>
      products.map((t) =>
        t._id === saved._id ? { ...t, label: saved.label, category: saved.category } : t,
      ),
    );
    this.detailsProduct.set(null);
    // Chip counts follow the category, and the product may leave the filter or search
    this.refresh();
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
