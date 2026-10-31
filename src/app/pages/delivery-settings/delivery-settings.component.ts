import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PricePipe } from '../../shared/price.pipe';
import { CURRENCY } from '../../shared/currency.config';
import { arrivalRange, deliveryIcon } from '../../shared/checkout.config';
import {
  DeliveryOption,
  DeliverySettings,
  MAX_DELIVERY_OPTIONS,
} from '../../models/delivery.model';
import {
  DeliveryOptionPayload,
  DeliveryService,
} from '../../services/delivery/delivery.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { LanguageService } from '../../services/language.service';
import { EmptyComponent } from '../../components/empty/empty.component';
import { IconComponent } from '../../components/icon/icon.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../design-manage/components/admin-toast/admin-toast.component';

const TOAST_DURATION = 4000;
// Same bounds as the server (services/delivery.js)
export const MAX_DELIVERY_DAYS = 60;
const MAX_NAME = 40;

// An option as edited: the price may be cleared while typing
type DraftOption = Omit<DeliveryOptionPayload, 'price'> & { price: number | null };

// Admin: the delivery options offered at checkout (MAX_DELIVERY_OPTIONS at most), each with
// its delay and price, and the subtotal it becomes free from. Orders keep the option they used
@Component({
  selector: 'app-delivery-settings',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SkeletonModule,
    TranslatePipe,
    PricePipe,
    EmptyComponent,
    IconComponent,
    AdminToastComponent,
  ],
  templateUrl: './delivery-settings.component.html',
  styleUrl: './delivery-settings.component.scss',
})
export class DeliverySettingsComponent implements OnInit {
  private deliveryService = inject(DeliveryService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  readonly maxOptions = MAX_DELIVERY_OPTIONS;
  readonly maxDays = MAX_DELIVERY_DAYS;
  readonly maxName = MAX_NAME;
  readonly currency = CURRENCY;

  loading = signal(true);
  failed = signal(false);
  saving = signal(false);
  toast = signal<AdminToast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // As last saved on the server, and as being edited
  saved = signal<DeliverySettings | null>(null);
  draft = signal<DraftOption[]>([]);

  edited = computed(() => {
    const saved = this.saved();
    return !!saved && JSON.stringify(this.draft()) !== JSON.stringify(this.draftOf(saved));
  });
  // Something to save: edits, or options never saved yet
  dirty = computed(() => this.edited() || this.saved()?.configured === false);
  // Per option, the first problem found (translation key), null when fine
  errors = computed(() => this.draft().map((o) => this.errorOf(o)));
  valid = computed(() => this.errors().every((e) => !e));

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

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.deliveryService.load().subscribe({
      next: (settings) => {
        this.saved.set(settings);
        this.draft.set(this.draftOf(settings));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load the delivery options', err);
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  update(index: number, changes: Partial<DraftOption>) {
    this.draft.update((options) => options.map((o, i) => (i === index ? { ...o, ...changes } : o)));
  }

  add() {
    if (this.draft().length >= MAX_DELIVERY_OPTIONS) return;
    this.draft.update((options) => [
      ...options,
      { name: '', minDays: 1, maxDays: 3, price: null, freeFrom: null },
    ]);
  }

  remove(index: number) {
    if (this.draft().length <= 1) return;
    this.draft.update((options) => options.filter((_, i) => i !== index));
  }

  // Free from an amount, or never: switching it on suggests the current threshold of the shop
  toggleFree(index: number, on: boolean) {
    this.update(index, { freeFrom: on ? (this.deliveryService.freeShippingFrom() ?? 50) : null });
  }

  // What the checkout will show of the option
  arrival(option: DraftOption): string {
    return arrivalRange(option, new Date(), this.language.current());
  }

  iconOf(option: DraftOption): string {
    return deliveryIcon(this.asOption(option), this.draft().map((o) => this.asOption(o)));
  }

  discard() {
    const saved = this.saved();
    if (saved) this.draft.set(this.draftOf(saved));
  }

  save() {
    if (this.saving() || !this.dirty() || !this.valid()) return;
    this.saving.set(true);
    const options: DeliveryOptionPayload[] = this.draft().map((o) => ({
      ...o,
      name: o.name.trim(),
      price: o.price ?? 0,
    }));
    this.deliveryService.save(options).subscribe({
      next: (settings) => {
        this.saving.set(false);
        this.saved.set(settings);
        this.draft.set(this.draftOf(settings));
        this.showToast('success', this.translate.instant('deliverySettings.saved'));
      },
      error: (err) => {
        console.error('Failed to save the delivery options', err);
        this.saving.set(false);
        this.showToast(
          'error',
          err?.error?.message || this.translate.instant('deliverySettings.saveFailed'),
        );
      },
    });
  }

  // Asked by the route guard before leaving with unsaved changes
  async confirmLeave(): Promise<boolean> {
    if (!this.edited()) return true;
    return this.confirm.ask({
      header: this.translate.instant('deliverySettings.leaveHeader'),
      message: this.translate.instant('deliverySettings.leaveMessage'),
      acceptLabel: this.translate.instant('pricing.leave'),
      acceptIcon: 'pi pi-sign-out',
      severity: 'danger',
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.edited()) event.preventDefault();
  }

  // Ctrl/Cmd + S saves the options
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
    }
  }

  // The default options have no name: they get their translated one to edit
  private draftOf(settings: DeliverySettings): DraftOption[] {
    return settings.options.map((o) => ({
      id: o.id,
      name: o.name || this.translate.instant(`checkout.delivery.${o.id}.title`),
      minDays: o.minDays,
      maxDays: o.maxDays,
      price: o.price,
      freeFrom: o.freeFrom,
    }));
  }

  private asOption(option: DraftOption): DeliveryOption {
    return { ...option, id: option.id ?? '', price: option.price ?? 0 };
  }

  private errorOf(option: DraftOption): string | null {
    if (!option.name.trim()) return 'deliverySettings.errors.name';
    const days = [option.minDays, option.maxDays];
    if (days.some((d) => d == null || !Number.isInteger(d) || d < 0 || d > MAX_DELIVERY_DAYS)) {
      return 'deliverySettings.errors.days';
    }
    if (option.maxDays < option.minDays) return 'deliverySettings.errors.order';
    if (option.price == null) return 'deliverySettings.errors.price';
    return null;
  }

  private showToast(type: AdminToast['type'], message: string) {
    clearTimeout(this.toastTimer);
    this.toast.set({ type, message });
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_DURATION);
  }
}
