import {
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PricingPayload, PricingService } from '../../services/pricing/pricing.service';
import { ProductsService } from '../../services/products/products.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { LanguageService } from '../../services/language.service';
import {
  CustomPricedProduct,
  priceBreakdown,
  PricingModel,
  PricingStats,
  PRODUCT_STYLES,
  ProductStyle,
} from '../../models/pricing.model';
import { tshirtTemplate } from '../../shared/templates';
import { environment } from '../../../environments/environment';
import { EmptyComponent } from '../../components/empty/empty.component';
import { QtyStepperComponent } from '../../components/qty-stepper/qty-stepper.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../design-manage/components/admin-toast/admin-toast.component';

// Light and dark mockups of each style, for its card
type StyleImages = { light: string; dark: string };

const TOAST_DURATION = 4000;
// Columns of the price list table: products with 1, 2 then 3 designs
const MATRIX_DESIGNS = [1, 2, 3];
const MAX_PRINTS = 10;

type PrintField = 'designPrice' | 'textPrice';
const PRINT_FIELDS: { key: PrintField; icon: string; name: string }[] = [
  { key: 'designPrice', icon: 'pi pi-image', name: 'design' },
  { key: 'textPrice', icon: 'pi pi-pencil', name: 'text' },
];

const emptyDraft = (): PricingPayload => ({
  styles: { regular: null, oversize: null, washed: null, sweatshirt: null },
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
  PRODUCT_STYLES.every((s) => a.styles[s] === b.styles[s]);

// Admin: the price list every product is priced from (base price per style, plus
// each design and text printed), a live preview, and the products priced by hand
@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyPipe,
    TranslatePipe,
    ButtonModule,
    InputNumberModule,
    SkeletonModule,
    TooltipModule,
    EmptyComponent,
    QtyStepperComponent,
    AdminToastComponent,
  ],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent implements OnInit, OnDestroy {
  private pricingService = inject(PricingService);
  private productsService = inject(ProductsService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  readonly styles = PRODUCT_STYLES;
  readonly matrixDesigns = MATRIX_DESIGNS;
  readonly maxPrints = MAX_PRINTS;
  readonly printFields = PRINT_FIELDS;
  readonly baseUrl = environment.baseUrl;
  readonly styleImages = Object.fromEntries(
    PRODUCT_STYLES.map((style) => {
      const templates = tshirtTemplate.filter((t) => t.style === style);
      const light = templates.find((t) => t.colorLabel.includes('white')) ?? templates[0];
      const dark = templates.find((t) => t.colorLabel.includes('black')) ?? templates[0];
      return [style, { light: light?.frontImg ?? '', dark: dark?.frontImg ?? '' }];
    }),
  ) as Record<ProductStyle, StyleImages>;

  loading = signal(true);
  failed = signal(false);
  saving = signal(false);
  resetting = signal(false);
  // Products whose custom price is being dropped
  resettingIds = signal<ReadonlySet<string>>(new Set());
  toast = signal<AdminToast | null>(null);

  // As last saved on the server, and as being edited
  saved = signal<PricingModel | null>(null);
  draft = signal<PricingPayload>(emptyDraft());
  stats = signal<PricingStats | null>(null);
  customProducts = signal<CustomPricedProduct[]>([]);

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
    PRODUCT_STYLES.filter((s) => this.draft().styles[s] == null),
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
    PRODUCT_STYLES.map((style) => ({
      style,
      prices: MATRIX_DESIGNS.map(
        (designs) => priceBreakdown(this.draft(), style, designs, 0)?.total ?? null,
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
      custom: this.pricingService.getCustomPriced(),
    }).subscribe({
      next: ({ pricing, stats, custom }) => {
        this.saved.set(pricing);
        this.draft.set(draftOf(pricing));
        this.stats.set(stats);
        this.customProducts.set(custom);
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
    this.draft.update((d) => ({ ...d, styles: { ...d.styles, [style]: price ?? null } }));
  }

  // Prints are always priced: an emptied field counts as free
  setPrintPrice(field: PrintField, price: number | null) {
    this.draft.update((d) => ({ ...d, [field]: price ?? 0 }));
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
    if (!saved?.configured || saved[field] === this.draft()[field]) return undefined;
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
    if (unpriced.length === PRODUCT_STYLES.length) {
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
        this.refreshCustomProducts();
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

  // One product goes back to the price list
  resetCustomPrice(product: CustomPricedProduct) {
    if (this.resettingIds().has(product._id)) return;
    this.setResetting(product._id, true);
    this.productsService.updatePrice(product._id, null).subscribe({
      next: () => {
        this.setResetting(product._id, false);
        this.customProducts.update((list) => list.filter((t) => t._id !== product._id));
        this.stats.update((stats) => stats && this.withoutCustom(stats, product.style));
        this.showToast(
          'success',
          this.translate.instant('pricing.customResetOne', { label: product.label }),
        );
      },
      error: (err) => {
        console.error('Failed to reset the custom price', err);
        this.setResetting(product._id, false);
        this.showToast('error', this.translate.instant('pricing.customResetFailed'));
      },
    });
  }

  async resetAllCustomPrices() {
    const count = this.customProducts().length;
    if (!count || this.resetting()) return;
    const ok = await this.confirm.ask({
      header: this.translate.instant('pricing.resetAllHeader'),
      message: this.translate.instant('pricing.resetAllMessage', { count }),
      acceptLabel: this.translate.instant('pricing.resetAll'),
      acceptIcon: 'pi pi-replay',
    });
    if (!ok) return;

    this.resetting.set(true);
    this.pricingService.resetCustomPrices().subscribe({
      next: ({ reset, stats }) => {
        this.resetting.set(false);
        this.customProducts.set([]);
        this.stats.set(stats);
        this.showToast(
          'success',
          this.translate.instant('pricing.customResetAll', { count: reset }),
        );
      },
      error: (err) => {
        console.error('Failed to reset the custom prices', err);
        this.resetting.set(false);
        this.showToast('error', this.translate.instant('pricing.customResetFailed'));
      },
    });
  }

  creatorName(product: CustomPricedProduct): string | null {
    const creator = product.createdBy;
    if (!creator || creator.role === 'admin') return null;
    return creator.username ? `@${creator.username}` : creator.name || null;
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

  private refreshCustomProducts() {
    this.pricingService.getCustomPriced().subscribe({
      next: (custom) => this.customProducts.set(custom),
      error: (err) => console.error('Failed to load the custom prices', err),
    });
  }

  private withoutCustom(stats: PricingStats, style: ProductStyle): PricingStats {
    const current = stats.styles[style];
    return {
      ...stats,
      custom: Math.max(stats.custom - 1, 0),
      styles: {
        ...stats.styles,
        [style]: { ...current, custom: Math.max(current.custom - 1, 0) },
      },
    };
  }

  private setResetting(id: string, busy: boolean) {
    this.resettingIds.update((ids) => {
      const next = new Set(ids);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private showToast(type: AdminToast['type'], message: string) {
    clearTimeout(this.toastTimer);
    this.toast.set({ type, message });
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_DURATION);
  }
}
