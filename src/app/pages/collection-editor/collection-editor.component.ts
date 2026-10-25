import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { PricePipe } from '../../shared/price.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../../components/empty/empty.component';
import { SearchInputComponent } from '../../components/search-input/search-input.component';
import { TagComponent } from '../../components/tag/tag.component';
import { CollectionsService, WallpaperChange } from '../../services/collections/collections.service';
import { ProductsService } from '../../services/products/products.service';
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

// Shape shown in the empty import field
const JSON_PLACEHOLDER = `{
  "name": "Marvel",
  "slug": "t-shirt-marvel",
  "featured": false,
  "title": { "fr": "T-shirts Marvel", "en": "Marvel T-shirts" },
  "eyebrow": { "fr": "...", "en": "..." },
  ...
}`;

type FormErrors = Partial<Record<'name' | 'slug' | 'title', string>>;

type Draft = {
  name: string;
  slug: string;
  featured: boolean;
  texts: Record<CollectionTextKey, LocalizedText>;
  products: CollectionProduct[];
};

const emptyDraft = (): Draft => ({
  name: '',
  slug: '',
  featured: false,
  texts: Object.fromEntries(COLLECTION_TEXTS.map((key) => [key, emptyText()])) as Draft['texts'],
  products: [],
});

// Admin: creates a collection ("new") or edits one. Its products are picked
// among the saved products, which stay sold in the store as usual.
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
    EmptyComponent,
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
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  readonly textFields = TEXT_FIELDS;
  readonly languages = LANGUAGES;
  readonly maxWallpaperMb = MAX_WALLPAPER_MB;
  readonly link = collectionLink;
  readonly jsonPlaceholder = JSON_PLACEHOLDER;

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

  // Import: a collection pasted as JSON fills the form (new collections only)
  jsonOpen = signal(false);
  jsonText = '';
  // Translation key of why the JSON was not applied
  jsonError = signal<string | null>(null);
  jsonApplied = signal(false);

  // Picker: every saved product, searched on the server
  pickerProducts = signal<CollectionProduct[]>([]);
  pickerCount = signal(0);
  pickerPage = signal(1);
  pickerLoading = signal(true);
  pickerLoadingMore = signal(false);
  pickerSearch = '';

  // What was last loaded or saved, to warn before leaving with changes
  private savedState = '';
  private pickerRequest?: Subscription;
  private baseUrl = environment.baseUrl;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.id = id && id !== 'new' ? id : null;
    if (this.id) this.load(this.id);
    else this.savedState = this.state();
    this.fetchPicker(1);
  }

  ngOnDestroy(): void {
    this.pickerRequest?.unsubscribe();
    this.revokePreview();
  }

  // ---------- Loading & saving ----------

  private load(id: string): void {
    this.loading.set(true);
    this.collectionsService.getCollection(id).subscribe({
      next: (collection) => {
        this.fill(collection);
        this.loading.set(false);
      },
      error: (err) => {
        if (err?.status !== 404) console.error('Failed to load the collection', err);
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  private fill(collection: CollectionModel): void {
    this.draft = {
      name: collection.name,
      slug: collection.slug,
      featured: collection.featured,
      texts: Object.fromEntries(
        COLLECTION_TEXTS.map((key) => [key, { ...emptyText(), ...collection[key] }]),
      ) as Draft['texts'],
      products: collection.products,
    };
    this.slugEdited = true;
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
        this.router.navigate(['/admin/collections']);
      },
      error: (err) => {
        console.error('Failed to save the collection', err);
        this.saving.set(false);
        this.saveError.set(
          err?.status === 409 ? 'collectionEditor.errors.slugTaken' : 'collectionEditor.saveFailed',
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

  // ---------- Import from JSON ----------

  toggleJson(): void {
    this.jsonOpen.update((open) => !open);
    this.jsonError.set(null);
  }

  // Fills the fields found in the JSON (same shape as a saved collection),
  // the others are kept. Products are still picked below.
  applyJson(): void {
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
    if (typeof json['slug'] === 'string') {
      this.onSlugChange(json['slug']);
      filled = true;
    }
    if (typeof json['featured'] === 'boolean') {
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

    if (!filled) {
      this.jsonError.set('collectionEditor.json.empty');
      return;
    }
    this.jsonError.set(null);
    this.jsonText = '';
    this.jsonOpen.set(false);
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

  toggle(product: CollectionProduct): void {
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

  private fetchPicker(page: number): void {
    if (page === 1) this.pickerLoading.set(true);
    else this.pickerLoadingMore.set(true);
    // A newer search wins over a response still on its way
    this.pickerRequest?.unsubscribe();
    this.pickerRequest = this.productsService
      .getProductsPage({ page, size: PICKER_PAGE_SIZE, search: this.pickerSearch })
      .subscribe({
        next: (data) => {
          const items: CollectionProduct[] = data.items.map((p) => ({
            _id: p._id,
            label: p.label,
            price: p.price,
            type: p.type,
            url: `${this.baseUrl}${p.url}`,
            backUrl: p.backUrl ? `${this.baseUrl}${p.backUrl}` : undefined,
          }));
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
