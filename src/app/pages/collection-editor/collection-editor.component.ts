import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { PricePipe } from '../../shared/price.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { PrimeTemplate } from 'primeng/api';
import { EmptyComponent } from '../../components/empty/empty.component';
import { CollectionShowcaseComponent } from '../../shared/collection-showcase/collection-showcase.component';
import { SearchInputComponent } from '../../components/search-input/search-input.component';
import { TagComponent } from '../../components/tag/tag.component';
import { CollectionsService, WallpaperChange } from '../../services/collections/collections.service';
import { ProductsService } from '../../services/products/products.service';
import { ProductModel } from '../../models/product.model';
import { AuthService } from '../../services/auth/auth.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { Language, LANGUAGES } from '../../services/language.service';
import {
  COLLECTION_TEXTS,
  CollectionModel,
  CollectionPayload,
  CollectionProduct,
  CollectionTextKey,
  collectionLink,
  emptyText,
  LocalizedText,
  SLUG_PATTERN,
  slugFrom,
} from '../../models/collection.model';
import { environment } from '../../../environments/environment';

type TextField = {
  key: CollectionTextKey;
  // Long texts get a textarea
  multiline?: boolean;
  required?: boolean;
};

// Texts of the form, in the order they show on the pages
const TEXT_FIELDS: TextField[] = [
  { key: 'title', required: true },
  { key: 'eyebrow' },
  { key: 'badge' },
  { key: 'description', multiline: true },
  { key: 'aboutTitle' },
  { key: 'aboutText', multiline: true },
];

// Saved products shown per "Show more" in the picker
const PICKER_PAGE_SIZE = 24;
// Same limit as the server
const MAX_WALLPAPER_MB = 10;

// Shape shown in the empty import field, the same as the one shown by "View JSON"
const JSON_PLACEHOLDER = `{
  "name": "Marvel",
  "slug": "t-shirt-marvel",
  "published": false,
  "featured": false,
  "title": { "fr": "T-shirts Marvel", "en": "Marvel T-shirts" },
  "eyebrow": { "fr": "...", "en": "..." },
  ...
  "products": ["<product id>", ...]
}`;

// The JSON panel: this collection shown to be copied, or another one pasted
type JsonMode = 'export' | 'import';

type FormErrors = Partial<Record<'name' | 'slug' | 'title', string>>;

type Draft = {
  name: string;
  slug: string;
  published: boolean;
  featured: boolean;
  texts: Record<CollectionTextKey, LocalizedText>;
  products: CollectionProduct[];
};

const emptyDraft = (): Draft => ({
  name: '',
  slug: '',
  // New collections start as drafts
  published: false,
  featured: false,
  texts: Object.fromEntries(COLLECTION_TEXTS.map((key) => [key, emptyText()])) as Draft['texts'],
  products: [],
});

// Admin: creates a collection ("new") or edits one. Its products are picked
// among the user's own products, which stay sold in the store as usual. Users
// get the same page for their own collections (/my-collections) and can't put
// them on the home page.
@Component({
  selector: 'app-collection-editor',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    RouterLink,
    PricePipe,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToggleSwitchModule,
    SkeletonModule,
    DialogModule,
    PrimeTemplate,
    EmptyComponent,
    CollectionShowcaseComponent,
    SearchInputComponent,
    TagComponent,
  ],
  templateUrl: './collection-editor.component.html',
  styleUrl: './collection-editor.component.scss',
})
export class CollectionEditorComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private collectionsService = inject(CollectionsService);
  private productsService = inject(ProductsService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  readonly textFields = TEXT_FIELDS;
  readonly languages = LANGUAGES;
  readonly maxWallpaperMb = MAX_WALLPAPER_MB;
  readonly link = collectionLink;
  readonly jsonPlaceholder = JSON_PLACEHOLDER;
  // Under /my-collections: back to the user's own list once saved
  readonly mine = !!this.route.snapshot.data['mine'];
  // The seller dashboard mounts the same pages under its own URL (route data.base)
  readonly base: string =
    this.route.snapshot.data['base'] ?? (this.mine ? '/my-collections' : '/admin/collections');
  // Only admins choose the collection of the home page
  readonly isAdmin = this.auth.isAdmin;

  // Id of the edited collection, null when creating one
  id: string | null = null;
  draft: Draft = emptyDraft();
  // The slug follows the name until it is typed by hand (new collections only)
  slugEdited = false;

  loading = signal(false);
  notFound = signal(false);
  saving = signal(false);
  // Validation messages show once a save was tried
  submitted = signal(false);
  // Server error of the last save (translation key)
  saveError = signal<string | null>(null);

  // Wallpaper: the one saved, then what the admin did with it
  savedWallpaper: string | null = null;
  wallpaperFile: File | null = null;
  wallpaperPreview: string | null = null;
  removeWallpaper = false;
  wallpaperError = signal<string | null>(null);

  // JSON: this collection to copy, or a collection pasted to fill the form
  jsonMode = signal<JsonMode | null>(null);
  jsonText = '';
  // Translation key of why the JSON was not applied
  jsonError = signal<string | null>(null);
  jsonApplied = signal(false);
  // The pasted products are being fetched
  jsonApplying = signal(false);
  // Pasted products that don't exist anymore or aren't the user's
  jsonSkipped = signal(0);
  jsonCopied = signal(false);
  private jsonCopiedTimer?: ReturnType<typeof setTimeout>;

  // The showcase as shown on /collections, opened from the save bar. Built on
  // open: the form can't change behind the dialog
  previewOpen = false;
  previewCollection: CollectionModel | null = null;
  // Maker of the edited collection, shown on the preview (the user for a new one)
  private owner: CollectionModel['createdBy'];

  // Text fields shown open: the required ones, until folded
  openTexts = signal(new Set(TEXT_FIELDS.filter((f) => f.required).map((f) => f.key)));

  // Picker: the user's own products, searched on the server
  pickerProducts = signal<CollectionProduct[]>([]);
  pickerCount = signal(0);
  pickerPage = signal(1);
  pickerLoading = signal(true);
  pickerLoadingMore = signal(false);
  pickerSearch = '';
  // A product is in one collection only: the products of the other collections, by id, with
  // the name of the collection they are in. They can't be picked
  private takenIn = signal<Record<string, string>>({});

  // What was last loaded or saved, to warn before leaving with changes
  private savedState = '';
  private pickerRequest?: Subscription;
  private baseUrl = environment.baseUrl;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.id = id && id !== 'new' ? id : null;
    if (this.id) this.load(this.id);
    else {
      this.savedState = this.state();
      this.loadTaken();
    }
    this.fetchPicker(1);
  }

  ngOnDestroy(): void {
    this.pickerRequest?.unsubscribe();
    this.revokePreview();
    clearTimeout(this.jsonCopiedTimer);
  }

  // ---------- Loading & saving ----------

  private load(id: string): void {
    this.loading.set(true);
    this.collectionsService.getCollection(id).subscribe({
      next: (collection) => {
        // Someone else's collection: the server would refuse the save
        if (!this.canEdit(collection)) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }
        this.fill(collection);
        this.loading.set(false);
        this.loadTaken();
      },
      error: (err) => {
        if (err?.status !== 404) console.error('Failed to load the collection', err);
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  // The products are the maker's: their other collections, or every one for an admin editing
  // someone else's
  private loadTaken(): void {
    const others = this.owner && this.owner._id !== this.auth.user()?._id;
    this.collectionsService.getCollections(others ? 'all' : 'mine').subscribe({
      next: (collections) => {
        const taken: Record<string, string> = {};
        for (const collection of collections) {
          if (collection._id === this.id) continue;
          for (const product of collection.products) {
            if (product._id) taken[product._id] ??= collection.name;
          }
        }
        this.takenIn.set(taken);
      },
      error: (err) => console.error('Failed to load the collections', err),
    });
  }

  // Under /my-collections only the user's own; admins edit the others from /admin/collections
  private canEdit(collection: CollectionModel): boolean {
    if (!this.mine) return this.isAdmin();
    return !!collection.createdBy && collection.createdBy._id === this.auth.user()?._id;
  }

  private fill(collection: CollectionModel): void {
    this.draft = {
      name: collection.name,
      slug: collection.slug,
      published: collection.published,
      featured: collection.featured,
      texts: Object.fromEntries(
        COLLECTION_TEXTS.map((key) => [key, { ...emptyText(), ...collection[key] }]),
      ) as Draft['texts'],
      products: collection.products,
    };
    this.slugEdited = true;
    this.owner = collection.createdBy;
    this.savedWallpaper = collection.wallpaper ?? null;
    this.wallpaperFile = null;
    this.removeWallpaper = false;
    this.revokePreview();
    this.savedState = this.state();
  }

  private payload(): CollectionPayload {
    return {
      name: this.draft.name.trim(),
      slug: this.draft.slug.trim(),
      published: this.draft.published,
      featured: this.draft.featured,
      ...this.draft.texts,
      products: this.draft.products.map((p) => p._id!),
    };
  }

  private wallpaperChange(): WallpaperChange {
    if (this.wallpaperFile) return this.wallpaperFile;
    return this.removeWallpaper && this.savedWallpaper ? 'remove' : null;
  }

  private state(): string {
    const wallpaper = this.wallpaperChange();
    return JSON.stringify({
      ...this.payload(),
      wallpaper: wallpaper instanceof File ? wallpaper.name : wallpaper,
    });
  }

  get dirty(): boolean {
    return this.state() !== this.savedState;
  }

  // Translation keys of what blocks the save
  get errors(): FormErrors {
    const errors: FormErrors = {};
    if (!this.draft.name.trim()) errors.name = 'collectionEditor.errors.name';
    if (!SLUG_PATTERN.test(this.draft.slug.trim())) errors.slug = 'collectionEditor.errors.slug';
    const title = this.draft.texts.title;
    if (!title.fr.trim() && !title.en.trim()) errors.title = 'collectionEditor.errors.title';
    return errors;
  }

  // Shown once a save was tried
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
      ? this.collectionsService.updateCollection(this.id, this.payload(), this.wallpaperChange())
      : this.collectionsService.createCollection(this.payload(), this.wallpaperChange());
    request.subscribe({
      next: (collection) => {
        this.saving.set(false);
        this.fill(collection);
        this.router.navigate([this.base]);
      },
      error: (err) => {
        console.error('Failed to save the collection', err);
        this.saving.set(false);
        // A product got added to another collection meanwhile: shown on its card
        const productTaken = err?.error?.code === 'productTaken';
        if (productTaken) this.loadTaken();
        this.saveError.set(
          productTaken
            ? 'collectionEditor.errors.productTaken'
            : err?.status === 409
              ? 'collectionEditor.errors.slugTaken'
              : 'collectionEditor.saveFailed',
        );
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

  // Ctrl/Cmd + S saves the collection
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
    }
  }

  // ---------- Name & address ----------

  onNameChange(name: string): void {
    this.draft.name = name;
    if (!this.slugEdited) this.draft.slug = slugFrom(name);
  }

  onSlugChange(slug: string): void {
    this.draft.slug = slug;
    this.slugEdited = true;
  }

  // ---------- Preview ----------

  openPreview(): void {
    if (this.hasErrors) return;
    this.previewCollection = {
      _id: this.id ?? 'new',
      name: this.draft.name,
      slug: this.draft.slug || 'new',
      published: this.draft.published,
      featured: this.draft.featured,
      ...this.draft.texts,
      wallpaper: this.wallpaperShown ?? undefined,
      createdBy: this.id ? this.owner : (this.auth.user() ?? undefined),
      products: this.draft.products,
    };
    this.previewOpen = true;
  }

  // ---------- Texts ----------

  isTextOpen(key: CollectionTextKey): boolean {
    return this.openTexts().has(key);
  }

  toggleText(key: CollectionTextKey): void {
    this.openTexts.update((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  // Shown on a folded field that has a text in any language
  hasText(key: CollectionTextKey): boolean {
    return LANGUAGES.some((lang) => !!this.draft.texts[key][lang]?.trim());
  }

  // ---------- JSON: copy this collection, paste another ----------

  toggleJson(mode: JsonMode): void {
    this.jsonMode.update((open) => (open === mode ? null : mode));
    this.jsonError.set(null);
    this.jsonCopied.set(false);
  }

  // The form as it is now (unsaved changes included), in the shape the import reads
  get exportedJson(): string {
    return JSON.stringify(this.payload(), null, 2);
  }

  async copyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.exportedJson);
      this.jsonCopied.set(true);
      clearTimeout(this.jsonCopiedTimer);
      this.jsonCopiedTimer = setTimeout(() => this.jsonCopied.set(false), 2000);
    } catch {
      // Clipboard not allowed: the JSON can still be selected in the field
    }
  }

  // Fills the fields found in the JSON (same shape as "View JSON"), the others
  // are kept. A collection already created keeps its page address. The products
  // listed replace the picked ones.
  applyJson(): void {
    if (this.jsonApplying()) return;
    let data: unknown;
    try {
      data = JSON.parse(this.jsonText);
    } catch {
      this.jsonError.set('collectionEditor.json.invalid');
      return;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      this.jsonError.set('collectionEditor.json.invalid');
      return;
    }

    const json = data as Record<string, unknown>;
    let filled = false;
    if (typeof json['name'] === 'string') {
      this.onNameChange(json['name']);
      filled = true;
    }
    if (!this.id && typeof json['slug'] === 'string') {
      this.onSlugChange(json['slug']);
      filled = true;
    }
    if (typeof json['published'] === 'boolean') {
      this.draft.published = json['published'];
      filled = true;
    }
    if (this.isAdmin() && typeof json['featured'] === 'boolean') {
      this.draft.featured = json['featured'];
      filled = true;
    }
    for (const key of COLLECTION_TEXTS) {
      const text = json[key] as Partial<Record<Language, unknown>> | undefined;
      if (!text || typeof text !== 'object') continue;
      for (const lang of LANGUAGES) {
        const value = text[lang];
        if (typeof value === 'string') {
          this.draft.texts[key][lang] = value;
          filled = true;
        }
      }
    }

    const products = json['products'];
    const ids = Array.isArray(products)
      ? [...new Set(products.filter((id): id is string => typeof id === 'string'))]
      : null;

    if (!filled && !ids) {
      this.jsonError.set('collectionEditor.json.empty');
      return;
    }
    if (!ids?.length) {
      if (ids) this.draft.products = [];
      this.jsonDone(0);
      return;
    }

    // Fetched for their pictures and labels; the ones that are gone are left out
    this.jsonApplying.set(true);
    const user = this.auth.user();
    forkJoin(
      ids.map((id) => this.productsService.getProduct(id).pipe(catchError(() => of(null)))),
    ).subscribe((found) => {
      const picked = found
        .filter((p): p is ProductModel => !!p)
        .filter((p) => p.createdBy?._id === user?._id && !this.takenBy(p))
        .map((p) => this.toCollectionProduct(p));
      this.draft.products = picked;
      this.jsonApplying.set(false);
      this.jsonDone(ids.length - picked.length);
    });
  }

  private jsonDone(skipped: number): void {
    this.jsonError.set(null);
    this.jsonText = '';
    this.jsonMode.set(null);
    this.jsonSkipped.set(skipped);
    this.jsonApplied.set(true);
  }

  // ---------- Wallpaper ----------

  get wallpaperShown(): string | null {
    if (this.wallpaperPreview) return this.wallpaperPreview;
    return this.removeWallpaper ? null : this.savedWallpaper;
  }

  onWallpaperPicked(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_WALLPAPER_MB * 1024 * 1024) {
      this.wallpaperError.set('collectionEditor.wallpaper.tooLarge');
      return;
    }
    this.wallpaperError.set(null);
    this.revokePreview();
    this.wallpaperFile = file;
    this.wallpaperPreview = URL.createObjectURL(file);
    this.removeWallpaper = false;
  }

  clearWallpaper(): void {
    this.revokePreview();
    this.wallpaperFile = null;
    this.removeWallpaper = true;
    this.wallpaperError.set(null);
  }

  private revokePreview(): void {
    if (this.wallpaperPreview) URL.revokeObjectURL(this.wallpaperPreview);
    this.wallpaperPreview = null;
  }

  // ---------- Products of the collection ----------

  isSelected(product: CollectionProduct): boolean {
    return this.draft.products.some((p) => p._id === product._id);
  }

  // Name of the other collection the product is in, null when it can be picked
  takenBy(product: Pick<CollectionProduct, '_id'>): string | null {
    return (product._id && this.takenIn()[product._id]) || null;
  }

  toggle(product: CollectionProduct): void {
    if (!this.isSelected(product) && this.takenBy(product)) return;
    this.draft.products = this.isSelected(product)
      ? this.draft.products.filter((p) => p._id !== product._id)
      : [...this.draft.products, product];
  }

  // The first products are the ones on the showcase
  move(index: number, delta: number): void {
    const to = index + delta;
    if (to < 0 || to >= this.draft.products.length) return;
    const products = [...this.draft.products];
    [products[index], products[to]] = [products[to], products[index]];
    this.draft.products = products;
  }

  // ---------- Picker ----------

  get pickerHasMore(): boolean {
    return this.pickerProducts().length < this.pickerCount();
  }

  onPickerSearch(value: string): void {
    this.pickerSearch = value;
    this.fetchPicker(1);
  }

  pickerMore(): void {
    if (this.pickerLoadingMore() || !this.pickerHasMore) return;
    this.fetchPicker(this.pickerPage() + 1);
  }

  // Server paths (/uploads/...) to urls the browser can load
  private toCollectionProduct(p: ProductModel): CollectionProduct {
    return {
      _id: p._id,
      label: p.label,
      price: p.price,
      type: p.type,
      url: `${this.baseUrl}${p.url}`,
      backUrl: p.backUrl ? `${this.baseUrl}${p.backUrl}` : undefined,
    };
  }

  private fetchPicker(page: number): void {
    if (page === 1) this.pickerLoading.set(true);
    else this.pickerLoadingMore.set(true);
    // A newer search wins over a response still on its way
    this.pickerRequest?.unsubscribe();
    this.pickerRequest = this.productsService
      .getProductsPage({
        page,
        size: PICKER_PAGE_SIZE,
        search: this.pickerSearch,
        mine: true,
      })
      .subscribe({
        next: (data) => {
          const items = data.items.map((p) => this.toCollectionProduct(p));
          this.pickerProducts.update((list) => (page === 1 ? items : [...list, ...items]));
          this.pickerCount.set(data.count);
          this.pickerPage.set(page);
          this.pickerLoading.set(false);
          this.pickerLoadingMore.set(false);
        },
        error: (err) => {
          console.error('Failed to load products', err);
          this.pickerLoading.set(false);
          this.pickerLoadingMore.set(false);
        },
      });
  }
}
