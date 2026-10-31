import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { LedgerTableComponent } from '../../../components/ledger-table/ledger-table.component';
import {
  ENTRY_STATUSES,
  EntryStatus,
  LedgerPage,
  LedgerQuery,
  MONEY_RANGES,
  MoneyRange,
  rangeQuery,
  Revenue,
  SeriesPoint,
} from '../../../models/seller.model';
import { LanguageService } from '../../../services/language.service';
import { MarketplaceService } from '../../../services/marketplace/marketplace.service';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { formatPrice } from '../../../shared/currency.config';
import { toneOf, trendPoints } from '../../../shared/marketplace';
import { PricePipe } from '../../../shared/price.pipe';
import { TrendChartComponent } from '../dashboard/charts/trend-chart.component';

const LEDGER_SIZE = 20;

// Figures the chart can show
const METRICS = ['commission', 'gross', 'refunds'] as const;
type Metric = (typeof METRICS)[number];
const METRIC_VALUE: Record<Metric, (p: SeriesPoint) => number> = {
  commission: (p) => p.commission,
  gross: (p) => p.gross,
  refunds: (p) => p.refunds,
};

// Admin: what the marketplace brings in. Gross sales are what customers paid for sellers'
// items; the platform's revenue is only its commission on them, apart from what is owed to
// the sellers. Every figure follows the period, the status and the seller picked
@Component({
  selector: 'app-admin-revenue',
  standalone: true,
  imports: [
    FormsModule,
    SelectModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    SkeletonModule,
    EmptyComponent,
    LedgerTableComponent,
    TrendChartComponent,
    AvatarUrlPipe,
    PricePipe,
  ],
  templateUrl: './admin-revenue.component.html',
  styleUrl: './admin-revenue.component.scss',
})
export class AdminRevenueComponent implements OnInit {
  private marketplace = inject(MarketplaceService);
  private language = inject(LanguageService);
  private translate = inject(TranslateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly ranges = MONEY_RANGES;
  readonly metrics = METRICS;
  readonly toneOf = toneOf;
  readonly formatPrice = (value: number) => formatPrice(value);
  readonly formatAxis = (value: number) => formatPrice(value, '1.0-0');

  readonly range = signal<MoneyRange>(30);
  readonly status = signal<EntryStatus | ''>('');
  readonly seller = signal('');
  readonly metric = signal<Metric>('commission');

  readonly revenue = signal<Revenue | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly ledger = signal<LedgerPage | null>(null);
  readonly ledgerPage = signal(1);
  readonly ledgerLoading = signal(false);

  // Status filter: every status, or one
  readonly statusOptions = computed(() => {
    this.language.current();
    return [
      { value: '', label: this.translate.instant('revenue.allStatuses') },
      ...ENTRY_STATUSES.map((s) => ({ value: s, label: this.translate.instant(`ledger.statuses.${s}`) })),
    ];
  });

  private locale = computed(() => (this.language.current() === 'fr' ? 'fr-FR' : 'en-GB'));

  readonly points = computed(() => {
    const revenue = this.revenue();
    return revenue ? trendPoints(revenue.series, METRIC_VALUE[this.metric()], this.locale()) : [];
  });

  readonly ledgerPages = computed(() => {
    const ledger = this.ledger();
    return ledger ? Math.max(1, Math.ceil(ledger.count / ledger.size)) : 1;
  });

  // Name of the seller filtered on, from the sellers of the period
  readonly sellerName = computed(() => {
    const id = this.seller();
    const found = this.revenue()?.sellers.find((s) => s._id === id);
    return found ? found.storeName || found.name : '';
  });

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  private query(): LedgerQuery {
    return { ...rangeQuery(this.range()), status: this.status(), seller: this.seller() };
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.marketplace.getRevenue(this.query()).subscribe({
      next: (revenue) => {
        this.revenue.set(revenue);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
    this.ledgerPage.set(1);
    this.loadLedger();
  }

  loadLedger() {
    this.ledgerLoading.set(true);
    this.marketplace.getLedger({ ...this.query(), page: this.ledgerPage(), size: LEDGER_SIZE }).subscribe({
      next: (ledger) => {
        this.ledger.set(ledger);
        this.ledgerLoading.set(false);
      },
      error: () => this.ledgerLoading.set(false),
    });
  }

  setRange(range: MoneyRange) {
    this.range.set(range);
    this.load();
  }

  setStatus(value: string) {
    this.status.set(value as EntryStatus | '');
    this.load();
  }

  filterSeller(id: string) {
    this.seller.set(this.seller() === id ? '' : id);
    this.load();
  }

  ledgerGoTo(page: number) {
    this.ledgerPage.set(page);
    this.loadLedger();
  }

  rangeLabel(range: MoneyRange): string {
    return range ? `dashboard.ranges.${range}` : 'dashboard.allTime';
  }
}
