import {
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { PricePipe } from '../../shared/price.pipe';
import { CURRENCY } from '../../shared/currency.config';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  PricingPayload,
  PricingService,
} from '../../services/pricing/pricing.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { LanguageService } from '../../services/language.service';
import {
  priceBreakdown,
  PricingModel,
  PricingStats,
  ProductStyle,
} from '../../models/pricing.model';
import { TemplatesService } from '../../services/templates/templates.service';
import { TemplateImagePipe } from '../../shared/template-image.pipe';
import { EmptyComponent } from '../../components/empty/empty.component';
import { QtyStepperComponent } from '../../components/qty-stepper/qty-stepper.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../design-manage/components/admin-toast/admin-toast.component';
import { TagComponent } from '../../components/tag/tag.component';
import { IconComponent } from '../../components/icon/icon.component';

// Light and dark mockups of each style, for its card
type StyleImages = { light: string; dark: string };

const TOAST_DURATION = 4000;
// Columns of the price list table: products with 1, 2 then 3 designs
const MATRIX_DESIGNS = [1, 2, 3];
const MAX_PRINTS = 10;
const MAX_PRICE = 10000;

// A typed price, kept between 0 and the max and rounded to the cent
const toPrice = (value: number | null): number | null =>
  value == null || Number.isNaN(value)
    ? null
    : Math.round(Math.min(Math.max(value, 0), MAX_PRICE) * 100) / 100;

type PrintField = 'designPrice' | 'textPrice';
const PRINT_FIELDS: { key: PrintField; icon: string; name: string }[] = [
  { key: 'designPrice', icon: 'pi pi-image', name: 'design' },
  { key: 'textPrice', icon: 'pi pi-pencil', name: 'text' },
];

const emptyDraft = (): PricingPayload => ({
  styles: {},
  designPrice: 0,
  textPrice: 0,
});

const draftOf = (pricing: PricingModel): PricingPayload => ({
  styles: { ...pricing.styles },
  designPrice: pricing.designPrice,
  textPrice: pricing.textPrice,
});

const sameDraft = (a: PricingPayload, b: PricingPayload) =>
  a.designPrice === b.designPrice &&
  a.textPrice === b.textPrice &&
  Object.keys({ ...a.styles, ...b.styles }).every(
    (s) => (a.styles[s] ?? null) === (b.styles[s] ?? null),
  );

// Admin: the price list every product is priced from (base price per style, plus
// each design and text printed) and a live preview
@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [
    TemplateImagePipe,
    IconComponent,
    TagComponent,
    FormsModule,
    PricePipe,
    TranslatePipe,
    ButtonModule,
    SelectModule,
    SkeletonModule,
    EmptyComponent,
    QtyStepperComponent,
    AdminToastComponent,
  ],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent implements OnInit, OnDestroy {
  private pricingService = inject(PricingService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private templatesService = inject(TemplatesService);

  // The admins' styles in the shop's order, as listed by the server's price list
  readonly styles = computed<ProductStyle[]>(() => Object.keys(this.saved()?.styles ?? {}));
  readonly matrixDesigns = MATRIX_DESIGNS;
  readonly maxPrints = MAX_PRINTS;
  readonly maxPrice = MAX_PRICE;
  readonly currency = CURRENCY;
  readonly printFields = PRINT_FIELDS;
  // A light and a dark tee of each style, from the templates the admins added
  readonly styleImages = computed(() => Object.fromEntries(
    this.styles().map((style) => {
      const templates = this.templatesService.templates().filter((t) => t.style === style);
      const light =
        templates.find((t) => !t.colorLabel.includes('black')) ?? templates[0];
      const dark =
        templates.find((t) => t.colorLabel.includes('black')) ?? templates[0];
      return [
        style,
        {
          light: light?.frontImg ?? '',
          dark: dark?.frontImg ?? '',
        },
      ];
    }),
  ) as Record<ProductStyle, StyleImages>);

  loading = signal(true);
  failed = signal(false);
  saving = signal(false);
  toast = signal<AdminToast | null>(null);

  // As last saved on the server, and as being edited
  saved = signal<PricingModel | null>(null);
  draft = signal<PricingPayload>(emptyDraft());
  stats = signal<PricingStats | null>(null);

  // Price preview
  previewStyle = signal<ProductStyle>('regular');
  previewDesigns = signal(1);
  previewTexts = signal(0);

  // Fields changed since the last save
  edited = computed(() => {
    const saved = this.saved();
    return !!saved && !sameDraft(this.draft(), draftOf(saved));
  });

  // Something to save: edits, or a price list never saved yet
  dirty = computed(() => this.edited() || this.saved()?.configured === false);

  // Products that follow the price list, repriced on save
  followingCount = computed(() => {
    const stats = this.stats();
    return stats ? stats.total - stats.custom : 0;
  });

  // Styles a customer can't buy with the current draft
  unpricedStyles = computed(() =>
    this.styles().filter((s) => this.draft().styles[s] == null),
  );

  preview = computed(() =>
    priceBreakdown(
      this.draft(),
      this.previewStyle(),
      this.previewDesigns(),
      this.previewTexts(),
    ),
  );

  // Price per style for 1, 2 and 3 designs, no text
  matrix = computed(() =>
    this.styles().map((style) => ({
      style,
      prices: MATRIX_DESIGNS.map(
        (designs) =>
          priceBreakdown(this.draft(), style, designs, 0)?.total ?? null,
      ),
    })),
  );

  lastSaved = computed(() => {
    const updatedAt = this.saved()?.updatedAt;
    if (!updatedAt) return null;
    return new Date(updatedAt).toLocaleString(this.language.current(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      pricing: this.pricingService.getPricing(),
      stats: this.pricingService.getStats(),
    }).subscribe({
      next: ({ pricing, stats }) => {
        this.saved.set(pricing);
        this.draft.set(draftOf(pricing));
        this.stats.set(stats);
        if (!this.styles().includes(this.previewStyle())) {
          this.previewStyle.set(this.styles()[0] ?? 'regular');
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load the pricing', err);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  setStylePrice(style: ProductStyle, price: number | null) {
    this.draft.update((d) => ({
      ...d,
      styles: { ...d.styles, [style]: toPrice(price) },
    }));
  }

  // Prints are always priced: an emptied field counts as free
  setPrintPrice(field: PrintField, price: number | null) {
    this.draft.update((d) => ({ ...d, [field]: toPrice(price) ?? 0 }));
  }

  // Saved value of a field, shown under it once changed
  savedStylePrice(style: ProductStyle): number | null | undefined {
    const saved = this.saved();
    if (!saved?.configured) return undefined;
    const value = saved.styles[style];
    return value === this.draft().styles[style] ? undefined : value;
  }

  savedPrintPrice(field: PrintField): number | undefined {
    const saved = this.saved();
    if (!saved?.configured || saved[field] === this.draft()[field])
      return undefined;
    return saved[field];
  }

  // A price list cell: shows that combination in the preview
  showInPreview(style: ProductStyle, designs: number) {
    this.previewStyle.set(style);
    this.previewDesigns.set(designs);
    this.previewTexts.set(0);
  }

  discard() {
    const saved = this.saved();
    if (saved) this.draft.set(draftOf(saved));
  }

  async save() {
    if (this.saving() || !this.dirty()) return;
    const unpriced = this.unpricedStyles();
    if (unpriced.length === this.styles().length) {
      const ok = await this.confirm.ask({
        header: this.translate.instant('pricing.nothingForSaleHeader'),
        message: this.translate.instant('pricing.nothingForSaleMessage'),
        acceptLabel: this.translate.instant('pricing.saveAnyway'),
        severity: 'danger',
      });
      if (!ok) return;
    }

    this.saving.set(true);
    this.pricingService.savePricing(this.draft()).subscribe({
      next: ({ pricing, repriced, stats }) => {
        this.saving.set(false);
        this.saved.set(pricing);
        this.draft.set(draftOf(pricing));
        this.stats.set(stats);
        this.showToast(
          'success',
          this.translate.instant(
            repriced === 1 ? 'pricing.savedOne' : 'pricing.saved',
            { count: repriced },
          ),
        );
      },
      error: (err) => {
        console.error('Failed to save the pricing', err);
        this.saving.set(false);
        this.showToast(
          'error',
          err?.error?.message || this.translate.instant('pricing.saveFailed'),
        );
      },
    });
  }

  // Asked by the route guard before leaving with unsaved changes
  async confirmLeave(): Promise<boolean> {
    if (!this.edited()) return true;
    return this.confirm.ask({
      header: this.translate.instant('pricing.leaveHeader'),
      message: this.translate.instant('pricing.leaveMessage'),
      acceptLabel: this.translate.instant('pricing.leave'),
      acceptIcon: 'pi pi-sign-out',
      severity: 'danger',
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.edited()) event.preventDefault();
  }

  // Ctrl/Cmd + S saves the price list
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
    }
  }

  private showToast(type: AdminToast['type'], message: string) {
    clearTimeout(this.toastTimer);
    this.toast.set({ type, message });
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_DURATION);
  }
}
