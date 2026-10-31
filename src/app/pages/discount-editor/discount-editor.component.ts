import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { EmptyComponent } from '../../components/empty/empty.component';
import { TagComponent } from '../../components/tag/tag.component';
import {
  CategoryChipsComponent,
  ChipItem,
} from '../../components/category-chips/category-chips.component';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { DiscountCardComponent } from '../../shared/discount-card/discount-card.component';
import { PricePipe } from '../../shared/price.pipe';
import { CURRENCY } from '../../shared/currency.config';
import {
  formatDuration,
  formatWhen,
  fromLocalInput,
  toLocalInput,
} from '../../shared/discount-dates';
import { CollectionsService } from '../../services/collections/collections.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { ProductsService } from '../../services/products/products.service';
import { DiscountsService } from '../../services/discounts/discounts.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { LanguageService, LANGUAGES } from '../../services/language.service';
import { CollectionModel, emptyText, LocalizedText } from '../../models/collection.model';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { PRODUCT_TYPES, ProductModel, ProductType } from '../../models/product.model';
import {
  discountBadge,
  DiscountCardData,
  DiscountKind,
  DiscountModel,
  DiscountPayload,
  DiscountPreview,
  DiscountProduct,
  DiscountScope,
  DiscountTarget,
  DiscountTheme,
  DISCOUNT_TARGET_ICONS,
  DISCOUNT_TARGETS,
  DISCOUNT_THEMES,
  MAX_PERCENT,
  salePrice,
  TakenTargets,
} from '../../models/discount.model';
import { environment } from '../../../environments/environment';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// One-click values of the offer
const QUICK_VALUES: Record<DiscountKind, number[]> = {
  percent: [10, 15, 20, 25, 30, 50],
  amount: [2, 5, 10, 15, 20],
};
// One-click lengths of the discount, from its start
const QUICK_DURATIONS = [
  { key: 'day', ms: DAY },
  { key: 'weekend', ms: 3 * DAY },
  { key: 'week', ms: 7 * DAY },
  { key: 'twoWeeks', ms: 14 * DAY },
  { key: 'month', ms: 30 * DAY },
];
// Price the example of the offer is shown on, when no product of the discount is known
const EXAMPLE_PRICE = 50;
const MAX_AMOUNT = 10000;
// Products browsed on the preview card (same as the server)
const PREVIEWS = 6;
// Products listed per page of the product picker, and the wait before searching what is typed
const PRODUCTS_PAGE = 24;
const SEARCH_DELAY = 250;
// Filter chip of every product type / category
const ALL = 'all';
// What a new discount can apply to: categories are only kept by the discounts made with them
const PICKABLE_TARGETS: DiscountTarget[] = DISCOUNT_TARGETS.filter((t) => t !== 'categories');

type StartMode = 'now' | 'scheduled';
type EndMode = 'never' | 'date';

type Draft = {
  name: string;
  kind: DiscountKind;
  value: number | null;
  target: DiscountTarget;
  collections: string[];
  categories: string[];
  products: string[];
  startMode: StartMode;
  // datetime-local values (local time)
  startsAt: string;
  endMode: EndMode;
  endsAt: string;
  enabled: boolean;
  showOnHome: boolean;
  title: LocalizedText;
  subtitle: LocalizedText;
  theme: DiscountTheme;
};

type FormErrors = Partial<Record<'name' | 'value' | 'targets' | 'startsAt' | 'endsAt', string>>;

// A new discount starts tonight at midnight when scheduled, and lasts a week
const nextMidnight = () => {
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  return date;
};

const emptyDraft = (): Draft => ({
  name: '',
  kind: 'percent',
  value: 20,
  target: 'collections',
  collections: [],
  categories: [],
  products: [],
  startMode: 'now',
  startsAt: toLocalInput(nextMidnight()),
  endMode: 'date',
  endsAt: toLocalInput(new Date(nextMidnight().getTime() + 7 * DAY)),
  enabled: true,
  showOnHome: true,
  title: emptyText(),
  subtitle: emptyText(),
  theme: 'default',
});

// Admin: creates a discount ("new") or edits one: its offer, the admin's own collections or
// products it applies to, when it runs and its card on the home page, previewed live.
// Users get the same page for their own products (/my-discounts): the offer, their
// collections or products and the dates, without a name or a home page card
@Component({
    selector: 'app-discount-editor',
    imports: [
        TranslatePipe,
        NgClass,
        FormsModule,
        RouterLink,
        PricePipe,
        ButtonModule,
        InputTextModule,
        InputNumberModule,
        ToggleSwitchModule,
        SkeletonModule,
        IconFieldModule,
        InputIconModule,
        EmptyComponent,
        TagComponent,
        CategoryChipsComponent,
        DialogComponent,
        DiscountCardComponent,
    ],
    templateUrl: './discount-editor.component.html',
    styleUrl: './discount-editor.component.scss'
})
export class DiscountEditorComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private discountsService = inject(DiscountsService);
  private collectionsService = inject(CollectionsService);
  private categoriesService = inject(CategoriesService);
  private productsService = inject(ProductsService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  // Under /my-discounts: only the user's own collections and products, back to their list
  // once saved
  readonly mine = !!this.route.snapshot.data['mine'];
  // The seller dashboard mounts the same pages under its own URL (route data.base)
  readonly base: string =
    this.route.snapshot.data['base'] ?? (this.mine ? '/my-discounts' : '/admin/discounts');
  readonly scope: DiscountScope = this.mine ? 'user' : 'global';

  readonly languages = LANGUAGES;
  readonly themes = DISCOUNT_THEMES;
  readonly targetIcons = DISCOUNT_TARGET_ICONS;
  readonly quickValues = QUICK_VALUES;
  readonly quickDurations = QUICK_DURATIONS;
  readonly currency = CURRENCY;
  readonly maxPercent = MAX_PERCENT;

  id: string | null = null;
  draft: Draft = emptyDraft();

  loading = signal(false);
  notFound = signal(false);
  saving = signal(false);
  submitted = signal(false);
  saveError = signal<string | null>(null);
  // The home card preview, opened from the save bar
  previewOpen = false;

  // What it can apply to
  collections = signal<CollectionModel[]>([]);
  categories = signal<DesignCategoryModel[]>([]);
  // Products per category id
  categoryCounts = signal<Record<string, number>>({});
  targetsLoading = signal(true);
  // Products and collections already under another discount: they can't be picked
  taken = signal<TakenTargets>({ products: {}, collections: {} });
  // A few products of the picked categories, for the preview card
  private categoryPreviews = signal<(DiscountPreview & { price?: number | null })[]>([]);

  // Product picker: the products matching the search, loaded page by page
  productSearch = '';
  productResults = signal<DiscountProduct[]>([]);
  productsTotal = signal(0);
  productsLoading = signal(false);
  // Total without search nor type: the search and filters only show when there are products
  hasProducts = signal(false);
  // Type and category filters of the picker, in a dialog like the product gallery's
  productType: ProductType | typeof ALL = ALL;
  productCategory = ALL;
  filtersOpen = signal(false);
  // Products per category for the current search and type, "all" being the total
  private productCounts = signal<Record<string, number>>({});
  private productsPage = 0;
  private productsLoaded = false;
  // Every product seen (picked or listed), by id, to show the picked ones whatever the search
  private knownProducts = new Map<string, DiscountProduct>();

  private savedState = '';
  private memos = new Map<string, { key: string; value: unknown }>();
  private previewRequest?: Subscription;
  private productsRequest?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private baseUrl = environment.baseUrl;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.id = id && id !== 'new' ? id : null;
    if (this.mine) this.draft.showOnHome = false;
    this.loadTargets();
    if (this.id) this.load(this.id);
    else this.savedState = this.state();
  }

  ngOnDestroy(): void {
    this.previewRequest?.unsubscribe();
    this.productsRequest?.unsubscribe();
    clearTimeout(this.searchTimer);
  }

  // ---------- Loading & saving ----------

  private load(id: string): void {
    this.loading.set(true);
    this.discountsService.getDiscount(id).subscribe({
      next: (discount) => {
        // Global discounts are edited from /admin/discounts, user ones from /my-discounts
        if (discount.scope !== this.scope) this.notFound.set(true);
        else this.fill(discount);
        this.loading.set(false);
      },
      error: (err) => {
        if (err?.status !== 404) console.error('Failed to load the discount', err);
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  // Categories also name the filter chips of the product picker. Everyone, admins too,
  // picks among their own collections (drafts included) and products
  private loadTargets(): void {
    let pending = this.mine ? 3 : 4;
    const done = () => --pending || this.targetsLoading.set(false);
    this.loadTaken(done);
    this.categoriesService.getAllCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: (err) => console.error('Failed to load categories', err),
      complete: done,
    });
    this.collectionsService.getCollections('mine').subscribe({
      next: (collections) => this.collections.set(collections),
      error: (err) => console.error('Failed to load collections', err),
      complete: done,
    });
    if (this.mine) return;
    this.productsService.getProductsPage({ page: 1, size: 1 }).subscribe({
      next: (page) => this.categoryCounts.set(page.counts || {}),
      error: (err) => console.error('Failed to load products counts', err),
      complete: done,
    });
  }

  private loadTaken(done?: () => void): void {
    this.discountsService.getTaken(this.id).subscribe({
      next: (taken) => this.taken.set(taken),
      error: (err) => console.error('Failed to load the discounted products', err),
      complete: done,
    });
  }

  private fill(discount: DiscountModel): void {
    const fallback = emptyDraft();
    this.draft = {
      name: discount.name,
      kind: discount.kind,
      value: discount.value,
      target: discount.target,
      collections: discount.collections.map((c) => c._id),
      categories: [...discount.categories],
      products: discount.products.map((p) => p._id),
      startMode: discount.startsAt ? 'scheduled' : 'now',
      startsAt: discount.startsAt ? toLocalInput(discount.startsAt) : fallback.startsAt,
      endMode: discount.endsAt ? 'date' : 'never',
      endsAt: discount.endsAt ? toLocalInput(discount.endsAt) : fallback.endsAt,
      enabled: discount.enabled,
      showOnHome: discount.showOnHome,
      title: { ...emptyText(), ...discount.title },
      subtitle: { ...emptyText(), ...discount.subtitle },
      theme: discount.theme,
    };
    for (const product of discount.products) {
      this.remember({ ...product, url: `${this.baseUrl}${product.url}` });
    }
    this.savedState = this.state();
    this.refreshCategoryPreviews();
    if (discount.target === 'products' && !this.productsLoaded) this.loadProducts();
  }

  private payload(): DiscountPayload {
    const d = this.draft;
    return {
      scope: this.scope,
      name: this.mine ? this.autoName : d.name.trim(),
      kind: d.kind,
      value: d.value ?? 0,
      target: d.target,
      collections: d.target === 'collections' ? d.collections : [],
      categories: d.target === 'categories' ? d.categories : [],
      products: d.target === 'products' ? d.products : [],
      startsAt: d.startMode === 'scheduled' ? fromLocalInput(d.startsAt) : null,
      endsAt: d.endMode === 'date' ? fromLocalInput(d.endsAt) : null,
      enabled: d.enabled,
      showOnHome: d.showOnHome,
      title: d.title,
      subtitle: d.subtitle,
      theme: d.theme,
    };
  }

  // Users don't name their discounts: named after the picked collections or products
  // ("Tee Spell +2")
  private get autoName(): string {
    const names =
      this.draft.target === 'collections'
        ? this.collections()
            .filter((c) => this.draft.collections.includes(c._id))
            .map((c) => c.name)
        : this.pickedProducts.map((p) => p.label);
    const [first, ...others] = names;
    if (!first) return this.badge;
    return others.length ? `${first} +${others.length}` : first;
  }

  // A user discount's name follows its targets (and the collections loading): left out
  private state(): string {
    const payload = this.payload();
    return JSON.stringify(this.mine ? { ...payload, name: '' } : payload);
  }

  get dirty(): boolean {
    return this.state() !== this.savedState;
  }

  // Translation keys of what blocks the save
  get errors(): FormErrors {
    const d = this.draft;
    const errors: FormErrors = {};
    if (!this.mine && !d.name.trim()) errors.name = 'discountEditor.errors.name';
    const max = d.kind === 'percent' ? MAX_PERCENT : MAX_AMOUNT;
    if (d.value == null || d.value <= 0 || d.value > max) errors.value = 'discountEditor.errors.value';
    if (!this.selectedTargets.length) errors.targets = 'discountEditor.errors.targets';
    else if (this.hasTakenPicks) errors.targets = 'discountEditor.errors.taken';
    const start = this.startTime;
    if (d.startMode === 'scheduled' && start == null) errors.startsAt = 'discountEditor.errors.date';
    if (d.endMode === 'date') {
      const end = this.endTime;
      if (end == null) errors.endsAt = 'discountEditor.errors.date';
      else if (end <= (start ?? Date.now())) errors.endsAt = 'discountEditor.errors.endBeforeStart';
    }
    return errors;
  }

  get shownErrors(): FormErrors {
    return this.submitted() ? this.errors : {};
  }

  get hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  save(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    this.saveError.set(null);
    if (this.hasErrors) return;

    this.saving.set(true);
    const request = this.id
      ? this.discountsService.updateDiscount(this.id, this.payload())
      : this.discountsService.createDiscount(this.payload());
    request.subscribe({
      next: (discount) => {
        this.saving.set(false);
        this.fill(discount);
        this.router.navigate([this.base]);
      },
      error: (err) => {
        console.error('Failed to save the discount', err);
        this.saving.set(false);
        // Something picked got discounted meanwhile: shown on its card
        if (err?.status === 409) this.loadTaken();
        this.saveError.set(err?.status === 409 ? 'discountEditor.takenFailed' : 'discountEditor.saveFailed');
      },
    });
  }

  async confirmLeave(): Promise<boolean> {
    if (!this.dirty || this.saving()) return true;
    return this.confirm.ask({
      header: this.translate.instant('collectionEditor.leaveHeader'),
      message: this.translate.instant('collectionEditor.leaveMessage'),
      acceptLabel: this.translate.instant('collectionEditor.leave'),
      acceptIcon: 'pi pi-sign-out',
      severity: 'danger',
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty) event.preventDefault();
  }

  // Ctrl/Cmd + S saves the discount
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
    }
  }

  // ---------- Offer ----------

  setKind(kind: DiscountKind): void {
    if (this.draft.kind === kind) return;
    this.draft.kind = kind;
    // A percentage rarely makes sense as an amount, and the other way round
    this.draft.value = QUICK_VALUES[kind][kind === 'percent' ? 2 : 1];
  }

  get badge(): string {
    return discountBadge({ kind: this.draft.kind, value: this.draft.value ?? 0 });
  }

  // "A 50.00 DT product sells for 40.00 DT", on a product of the discount when one is known
  get example(): { price: number; sale: number } {
    const known =
      this.draft.target === 'categories'
        ? this.categoryPreviews()[0]?.price
        : this.draft.target === 'products'
          ? this.pickedProducts.find((p) => p.price != null)?.price
          : null;
    const price = known ?? EXAMPLE_PRICE;
    return { price, sale: salePrice(price, { kind: this.draft.kind, value: this.draft.value ?? 0 }) };
  }

  // ---------- Targets ----------

  // A discount made with categories keeps that choice until another one is picked
  get targets(): DiscountTarget[] {
    return this.draft.target === 'categories' ? [...DISCOUNT_TARGETS] : PICKABLE_TARGETS;
  }

  setTarget(target: DiscountTarget): void {
    this.draft.target = target;
    this.refreshCategoryPreviews();
    if (target === 'products' && !this.productsLoaded) this.loadProducts();
  }

  get selectedTargets(): string[] {
    return this.draft[this.draft.target];
  }

  isPicked(id: string): boolean {
    return this.selectedTargets.includes(id);
  }

  togglePick(id: string): void {
    const key = this.draft.target;
    const list = this.draft[key];
    if (!list.includes(id) && this.takenBy(id)) return;
    this.draft[key] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    if (key === 'categories') this.refreshCategoryPreviews();
  }

  // Products: the ones listed are added to those already picked
  pickAll(): void {
    if (this.draft.target === 'collections') {
      this.draft.collections = this.collections()
        .map((c) => c._id)
        .filter((id) => this.draft.collections.includes(id) || !this.takenBy(id));
    } else if (this.draft.target === 'products') {
      const listed = this.productResults()
        .map((p) => p._id)
        .filter((id) => !this.takenBy(id));
      this.draft.products = [...new Set([...this.draft.products, ...listed])];
    } else {
      this.draft.categories = this.categories().map((c) => c._id);
      this.refreshCategoryPreviews();
    }
  }

  clearPicks(): void {
    this.draft[this.draft.target] = [];
    if (this.draft.target === 'categories') this.refreshCategoryPreviews();
  }

  // Name of the other discount a product or collection of the current target is already under
  // (a collection is when one of its products is), null when it can be picked
  takenBy(id: string): string | null {
    const taken = this.taken();
    if (this.draft.target === 'products') return taken.products[id] ?? null;
    if (this.draft.target !== 'collections') return null;
    if (taken.collections[id]) return taken.collections[id];
    const collection = this.collections().find((c) => c._id === id);
    const product = collection?.products.find((p) => p._id && taken.products[p._id]);
    return product ? taken.products[product._id!] : null;
  }

  // Picked before the other discount took them (or kept from an old discount): to remove.
  // A discount that has already ended holds nothing (same as the server)
  get hasTakenPicks(): boolean {
    return !this.endsInPast && this.selectedTargets.some((id) => this.takenBy(id));
  }

  // Products discounted: those of the picked collections (once each), of the picked categories,
  // or the picked products
  get reach(): number {
    if (this.draft.target === 'products') return this.draft.products.length;
    if (this.draft.target === 'collections') {
      const ids = new Set<string>();
      for (const collection of this.collections()) {
        if (!this.draft.collections.includes(collection._id)) continue;
        for (const product of collection.products) if (product._id) ids.add(product._id);
      }
      return ids.size;
    }
    const counts = this.categoryCounts();
    return this.draft.categories.reduce((sum, id) => sum + (counts[id] || 0), 0);
  }

  // A few products of the first picked category
  private refreshCategoryPreviews(): void {
    this.previewRequest?.unsubscribe();
    const category = this.draft.target === 'categories' ? this.draft.categories[0] : undefined;
    if (!category) return this.categoryPreviews.set([]);
    this.previewRequest = this.productsService
      .getProductsPage({ page: 1, size: PREVIEWS, category })
      .subscribe({
        next: (page) =>
          this.categoryPreviews.set(
            page.items.map((p) => ({
              _id: p._id!,
              label: p.label,
              price: p.price,
              url: `${this.baseUrl}${p.url}`,
            })),
          ),
        error: (err) => console.error('Failed to load products', err),
      });
  }

  // Picked products, in the order they were picked
  get pickedProducts(): DiscountProduct[] {
    return this.memo(
      'pickedProducts',
      this.draft.products
        .map((id) => this.knownProducts.get(id))
        .filter((p): p is DiscountProduct => !!p),
    );
  }

  // Price of a product once discounted
  saleOf(price: number): number {
    return salePrice(price, { kind: this.draft.kind, value: this.draft.value ?? 0 });
  }

  onProductSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadProducts(), SEARCH_DELAY);
  }

  // The first page of the products matching the search, or the next one (more)
  loadProducts(more = false): void {
    clearTimeout(this.searchTimer);
    this.productsRequest?.unsubscribe();
    const page = more ? this.productsPage + 1 : 1;
    this.productsLoaded = true;
    this.productsLoading.set(true);
    this.productsRequest = this.productsService
      .getProductsPage({
        page,
        size: PRODUCTS_PAGE,
        search: this.productSearch,
        mine: true,
        type: this.productType === ALL ? undefined : this.productType,
        category: this.productCategory === ALL ? undefined : this.productCategory,
      })
      .subscribe({
        next: (result) => {
          const items = result.items.map((p) => this.remember(this.toPick(p)));
          this.productsPage = page;
          this.productResults.set(more ? [...this.productResults(), ...items] : items);
          this.productsTotal.set(result.count);
          this.productCounts.set(result.counts || {});
          // Counts follow the search and type: a filter with no match must not hide them
          if (!this.productSearch.trim() && this.productType === ALL)
            this.hasProducts.set((result.counts?.[ALL] || 0) > 0);
          this.productsLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load products', err);
          this.productsLoading.set(false);
        },
      });
  }

  // Shown as a badge on the filters button
  get activeFilters(): number {
    return +(this.productType !== ALL) + +(this.productCategory !== ALL);
  }

  // "All", then one chip per product type (t-shirts, sweatshirts)
  readonly typeFilters: ChipItem[] = [
    { id: ALL, label: 'common.all' },
    ...PRODUCT_TYPES.map((type) => ({ id: type, label: `gallery.types.${type}` })),
  ];

  // "All", then every category with its products for the current search and type
  get categoryFilters(): ChipItem[] {
    const counts = this.productCounts();
    return this.memo('categoryFilters', [
      { id: ALL, label: 'common.all', count: counts[ALL] || 0 },
      ...this.categories().map((c) => ({ id: c._id, label: c.label, count: counts[c._id] || 0 })),
    ]);
  }

  selectProductType(id: string): void {
    this.productType = id as ProductType | typeof ALL;
    this.loadProducts();
  }

  selectProductCategory(id: string): void {
    this.productCategory = id;
    this.loadProducts();
  }

  resetProductFilters(): void {
    this.productType = ALL;
    this.productCategory = ALL;
    this.loadProducts();
  }

  private toPick(product: ProductModel): DiscountProduct {
    return {
      _id: product._id!,
      label: product.label,
      url: `${this.baseUrl}${product.url}`,
      price: product.price,
    };
  }

  private remember(product: DiscountProduct): DiscountProduct {
    this.knownProducts.set(product._id, product);
    return product;
  }

  // ---------- Schedule ----------

  get startTime(): number | null {
    if (this.draft.startMode === 'now') return null;
    const iso = fromLocalInput(this.draft.startsAt);
    return iso ? new Date(iso).getTime() : null;
  }

  get endTime(): number | null {
    if (this.draft.endMode === 'never') return null;
    const iso = fromLocalInput(this.draft.endsAt);
    return iso ? new Date(iso).getTime() : null;
  }

  setStartMode(mode: StartMode): void {
    this.draft.startMode = mode;
    // Keeps the end after the start
    const start = this.startTime;
    const end = this.endTime;
    if (start != null && end != null && end <= start) this.setDuration(7 * DAY);
  }

  setEndMode(mode: EndMode): void {
    this.draft.endMode = mode;
  }

  setDuration(ms: number): void {
    this.draft.endMode = 'date';
    this.draft.endsAt = toLocalInput(new Date((this.startTime ?? Date.now()) + ms));
  }

  // The quick duration matching the current end, highlighted
  isDuration(ms: number): boolean {
    const end = this.endTime;
    return end != null && Math.abs(end - (this.startTime ?? Date.now()) - ms) < 60_000;
  }

  get scheduleSummary(): { start: string; end: string; length: string | null } {
    const lang = this.language.current();
    const start = this.startTime;
    const end = this.endTime;
    return {
      start: start != null ? formatWhen(new Date(start), lang) : this.translate.instant('discountEditor.schedule.onSave'),
      end: end != null ? formatWhen(new Date(end), lang) : this.translate.instant('discountEditor.schedule.never'),
      length: end != null ? formatDuration(end - (start ?? Date.now()), lang) : null,
    };
  }

  // Saving it as is would make it end right away
  get endsInPast(): boolean {
    const end = this.endTime;
    return end != null && end <= Date.now();
  }

  // ---------- Home card ----------

  // What the card will show once saved
  get previewCard(): DiscountCardData {
    const p = this.payload();
    const start = this.startTime;
    return this.memo('card', {
      kind: p.kind,
      value: p.value,
      target: p.target,
      collections: this.collections()
        .filter((c) => p.collections.includes(c._id))
        .map(({ _id, name, slug }) => ({ _id, name, slug })),
      categories: p.categories,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      title: p.title,
      subtitle: p.subtitle,
      theme: p.theme,
      status: start != null && start > Date.now() ? 'scheduled' : 'live',
      previews: this.previewShots,
    });
  }

  private get previewShots(): DiscountPreview[] {
    if (this.draft.target === 'categories') return this.categoryPreviews();
    // Like the server, only the ones for sale
    if (this.draft.target === 'products') {
      return this.pickedProducts.filter((p) => p.price != null).slice(0, PREVIEWS);
    }
    return this.collections()
      .filter((c) => this.draft.collections.includes(c._id))
      .flatMap((c) => c.products)
      .slice(0, PREVIEWS)
      .map((p) => ({ _id: p._id!, url: p.url, label: p.label, price: p.price }));
  }

  // Readiness of each step, shown next to the preview
  get checklist(): { key: string; done: boolean }[] {
    const errors = this.errors;
    return this.memo('checklist', [
      { key: 'offer', done: !errors.name && !errors.value },
      { key: 'targets', done: !errors.targets },
      { key: 'schedule', done: !errors.startsAt && !errors.endsAt },
    ]);
  }

  // The same object while its content is the same: getters bound to inputs must not
  // hand a new one on every change detection
  private memo<T>(name: string, value: T): T {
    const key = JSON.stringify(value);
    const cached = this.memos.get(name);
    if (cached?.key === key) return cached.value as T;
    this.memos.set(name, { key, value });
    return value;
  }
}
