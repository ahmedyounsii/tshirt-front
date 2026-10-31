import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { CategoryChipsComponent, ChipItem } from '../../../components/category-chips/category-chips.component';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { SearchInputComponent } from '../../../components/search-input/search-input.component';
import { AuditEntry, AuditPage, CommissionSettings, SellersPage, SellerSummary } from '../../../models/seller.model';
import { MarketplaceService } from '../../../services/marketplace/marketplace.service';
import { ConfirmService } from '../../../services/confirm/confirm.service';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { toneOf } from '../../../shared/marketplace';
import { PricePipe } from '../../../shared/price.pipe';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';

const PAGE_SIZE = 20;
const AUDIT_SIZE = 10;

// Rate typed in a field: a number between 0 and 100 with 2 decimals at most, else null
const parseRate = (value: string | number | null): number | null => {
  if (value === null || value === '') return null;
  const rate = Number(String(value).replace(',', '.'));
  const twoDecimals = Math.abs(Math.round(rate * 100) - rate * 100) < 1e-9;
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 && twoDecimals ? rate : null;
};

// Admin: the platform commission (default rate, applied to the orders placed after a change)
// and the sellers: their own rate, suspension, balances and the payouts made to them outside
// the platform. The audit log lists the sensitive changes
@Component({
  selector: 'app-admin-sellers',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    TextareaModule,
    CategoryChipsComponent,
    EmptyComponent,
    SearchInputComponent,
    AvatarUrlPipe,
    PricePipe,
    DialogComponent,
  ],
  templateUrl: './admin-sellers.component.html',
  styleUrl: './admin-sellers.component.scss',
})
export class AdminSellersComponent implements OnInit {
  private marketplace = inject(MarketplaceService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly toneOf = toneOf;

  // Default rate
  readonly settings = signal<CommissionSettings | null>(null);
  defaultRateInput = '';
  readonly savingRate = signal(false);
  readonly rateMessage = signal<{ ok: boolean; text: string } | null>(null);

  // Sellers
  readonly page = signal<SellersPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly status = signal('');
  readonly search = signal('');
  readonly pageIndex = signal(1);

  readonly chips = computed<ChipItem[]>(() => {
    const counts = this.page()?.counts ?? {};
    return [
      { id: '', label: 'common.all', count: counts.all ?? 0 },
      { id: 'active', label: 'adminSellers.sellerStatus.active', count: counts.active ?? 0 },
      { id: 'suspended', label: 'adminSellers.sellerStatus.suspended', count: counts.suspended ?? 0 },
      { id: 'closed', label: 'adminSellers.sellerStatus.closed', count: counts.closed ?? 0 },
    ];
  });

  readonly pages = computed(() => {
    const page = this.page();
    return page ? Math.max(1, Math.ceil(page.count / page.size)) : 1;
  });

  // Seller dialog
  readonly selected = signal<SellerSummary | null>(null);
  readonly dialogOpen = signal(false);
  readonly busy = signal(false);
  readonly dialogError = signal<string | null>(null);
  readonly dialogMessage = signal<string | null>(null);
  sellerRateInput = '';
  suspendReason = '';
  deleteReason = '';
  readonly deleting = signal(false);
  payoutReference = '';
  payoutNote = '';
  readonly payoutOpen = signal(false);

  // Audit log
  readonly audit = signal<AuditPage | null>(null);
  readonly auditPage = signal(1);
  readonly auditError = signal<string | null>(null);

  ngOnInit() {
    if (!this.isBrowser) return;
    this.loadSettings();
    this.load();
    this.loadAudit();
    // Opened from a seller application ("Manage the store"): straight to that seller
    const id = this.route.snapshot.queryParamMap.get('seller');
    if (id) {
      this.marketplace.getSeller(id).subscribe({
        next: (seller) => this.open(seller),
        error: () => this.rateMessage.set({ ok: false, text: this.translate.instant('adminSellers.loadFailed') }),
      });
    }
  }

  loadSettings() {
    this.marketplace.getSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.defaultRateInput = String(settings.defaultRate);
      },
      error: () => this.rateMessage.set({ ok: false, text: this.translate.instant('adminSellers.commission.loadFailed') }),
    });
  }

  saveDefaultRate() {
    const rate = parseRate(this.defaultRateInput);
    if (rate === null) {
      this.rateMessage.set({ ok: false, text: this.translate.instant('adminSellers.commission.invalid') });
      return;
    }
    this.savingRate.set(true);
    this.rateMessage.set(null);
    this.marketplace.saveDefaultRate(rate).subscribe({
      next: (settings) => {
        this.savingRate.set(false);
        this.settings.set(settings);
        this.rateMessage.set({ ok: true, text: this.translate.instant('adminSellers.commission.saved') });
        this.load();
        this.loadAudit();
      },
      error: (err: HttpErrorResponse) => {
        this.savingRate.set(false);
        this.rateMessage.set({ ok: false, text: err.error?.message || this.translate.instant('adminSellers.actionFailed') });
      },
    });
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.marketplace
      .getSellers({ page: this.pageIndex(), size: PAGE_SIZE, status: this.status(), search: this.search() })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  loadAudit() {
    this.auditError.set(null);
    this.marketplace.getAudit({ page: this.auditPage(), size: AUDIT_SIZE }).subscribe({
      next: (audit) => this.audit.set(audit),
      error: () => this.audit.set(null),
    });
  }

  async deleteAuditEntry(entry: AuditEntry) {
    const ok = await this.confirm.ask({
      header: this.translate.instant('adminSellers.audit.deleteEntryTitle'),
      message: this.translate.instant('adminSellers.audit.deleteEntryText', { action: this.auditLabel(entry.action) }),
      acceptLabel: this.translate.instant('common.delete'),
      acceptIcon: 'pi pi-trash',
      severity: 'danger',
    });
    if (!ok) return;
    this.marketplace.deleteAuditEntry(entry._id).subscribe({
      next: () => {
        // The last entry of a page gone: back one page
        const audit = this.audit();
        if (audit && audit.items.length === 1 && this.auditPage() > 1) this.auditPage.update((p) => p - 1);
        this.loadAudit();
      },
      error: () => this.auditError.set(this.translate.instant('adminSellers.actionFailed')),
    });
  }

  async clearAudit() {
    const ok = await this.confirm.ask({
      header: this.translate.instant('adminSellers.audit.clearTitle'),
      message: this.translate.instant('adminSellers.audit.clearText'),
      acceptLabel: this.translate.instant('adminSellers.audit.clear'),
      acceptIcon: 'pi pi-trash',
      severity: 'danger',
    });
    if (!ok) return;
    this.marketplace.clearAudit().subscribe({
      next: () => {
        this.auditPage.set(1);
        this.loadAudit();
      },
      error: () => this.auditError.set(this.translate.instant('adminSellers.actionFailed')),
    });
  }

  auditGoTo(page: number) {
    this.auditPage.set(page);
    this.loadAudit();
  }

  auditPages = computed(() => {
    const audit = this.audit();
    return audit ? Math.max(1, Math.ceil(audit.count / audit.size)) : 1;
  });

  // "commission.seller" -> its translated label
  auditLabel(action: string): string {
    const key = `adminSellers.audit.actions.${action}`;
    const label = this.translate.instant(key);
    return label === key ? action : label;
  }

  auditDetails(details?: Record<string, unknown>): string {
    if (!details) return '';
    const parts: string[] = [];
    if ('from' in details || 'to' in details) {
      const rate = (v: unknown) => (v === null || v === undefined ? this.translate.instant('adminSellers.commission.default') : `${v}%`);
      parts.push(`${rate(details['from'])} → ${rate(details['to'])}`);
    }
    if (details['reason']) parts.push(String(details['reason']));
    if (details['reference']) parts.push(String(details['reference']));
    if (typeof details['amountCents'] === 'number') parts.push(`${(details['amountCents'] as number) / 100}`);
    if (details['code']) parts.push(`…${details['code']}`);
    if (details['storeName']) parts.push(String(details['storeName']));
    if (details['store']) parts.push(String(details['store']));
    if (typeof details['count'] === 'number') {
      parts.push(this.translate.instant('adminSellers.audit.removed', { count: details['count'] }));
    }
    if (typeof details['quantity'] === 'number') parts.push(`×${details['quantity']}`);
    return parts.join(' · ');
  }

  onStatus(status: string) {
    this.status.set(status);
    this.pageIndex.set(1);
    this.load();
  }

  onSearch(search: string) {
    this.search.set(search);
    this.pageIndex.set(1);
    this.load();
  }

  goTo(page: number) {
    this.pageIndex.set(page);
    this.load();
  }

  open(seller: SellerSummary) {
    this.selected.set(seller);
    this.sellerRateInput = seller.customRate !== null ? String(seller.customRate) : '';
    this.suspendReason = '';
    this.deleteReason = '';
    this.deleting.set(false);
    this.payoutReference = '';
    this.payoutNote = '';
    this.payoutOpen.set(false);
    this.dialogError.set(null);
    this.dialogMessage.set(null);
    this.dialogOpen.set(true);
    // With the payouts and fresh totals
    this.marketplace.getSeller(seller._id).subscribe({
      next: (full) => this.selected.set(full),
      error: () => this.dialogError.set(this.translate.instant('adminSellers.loadFailed')),
    });
  }

  saveSellerRate(reset = false) {
    const seller = this.selected();
    if (!seller) return;
    const rate = reset ? null : parseRate(this.sellerRateInput);
    if (!reset && rate === null) {
      this.dialogError.set(this.translate.instant('adminSellers.commission.invalid'));
      return;
    }
    this.run(this.marketplace.setSellerRate(seller._id, rate), (updated) => {
      this.sellerRateInput = updated.customRate !== null ? String(updated.customRate) : '';
      this.dialogMessage.set(this.translate.instant('adminSellers.commission.saved'));
      this.selected.update((s) => (s ? { ...s, ...updated } : s));
    });
  }

  setStatus(status: 'active' | 'suspended') {
    const seller = this.selected();
    if (!seller) return;
    this.run(this.marketplace.setSellerStatus(seller._id, status, this.suspendReason.trim()), (updated) => {
      this.suspendReason = '';
      this.selected.update((s) => (s ? { ...s, ...updated } : s));
    });
  }

  // Wipes the store and seller access (once paid out): the user is no longer a seller, so the
  // dialog closes; the ledger and payouts stay
  deleteStore() {
    const seller = this.selected();
    if (!seller) return;
    this.run(this.marketplace.deleteStore(seller._id, this.deleteReason.trim()), () => {
      this.deleting.set(false);
      this.deleteReason = '';
      this.dialogOpen.set(false);
      this.selected.set(null);
    });
  }

  recordPayout() {
    const seller = this.selected();
    if (!seller) return;
    if (!this.payoutReference.trim()) {
      this.dialogError.set(this.translate.instant('adminSellers.payout.referenceRequired'));
      return;
    }
    this.run(this.marketplace.recordPayout(seller._id, this.payoutReference.trim(), this.payoutNote.trim()), () => {
      this.payoutOpen.set(false);
      this.dialogMessage.set(this.translate.instant('adminSellers.payout.recorded'));
      this.marketplace.getSeller(seller._id).subscribe((full) => this.selected.set(full));
    });
  }

  private run<T>(request: Observable<T>, done: (value: T) => void) {
    this.busy.set(true);
    this.dialogError.set(null);
    this.dialogMessage.set(null);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        done(value);
        this.load();
        this.loadAudit();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.dialogError.set(
          err.error?.code === 'unpaidEarnings'
            ? this.translate.instant('adminSellers.access.unpaidEarnings')
            : err.error?.message || this.translate.instant('adminSellers.actionFailed'),
        );
      },
    });
  }
}
