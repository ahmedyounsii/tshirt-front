import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
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
  MONEY_RANGES,
  MoneyRange,
  rangeQuery,
  SellerEarnings,
} from '../../../models/seller.model';
import { LanguageService } from '../../../services/language.service';
import { SellerService } from '../../../services/seller/seller.service';
import { formatPrice } from '../../../shared/currency.config';
import { trendPoints } from '../../../shared/marketplace';
import { PricePipe } from '../../../shared/price.pipe';
import { TrendChartComponent } from '../../admin/dashboard/charts/trend-chart.component';

const PAGE_SIZE = 25;

// Seller: how their sales turn into earnings. Each line keeps the commission rate of the day
// it was made. Earnings on unpaid orders are pending, delivered (paid) ones are available,
// and only a payout recorded by the shop moves them to paid out: nothing here moves money
@Component({
    selector: 'app-seller-earnings',
    imports: [
        DatePipe,
        FormsModule,
        TranslatePipe,
        ButtonModule,
        SelectModule,
        SkeletonModule,
        EmptyComponent,
        LedgerTableComponent,
        TrendChartComponent,
        PricePipe,
    ],
    templateUrl: './seller-earnings.component.html',
    styleUrl: './seller-earnings.component.scss'
})
export class SellerEarningsComponent implements OnInit {
  private sellerService = inject(SellerService);
  private language = inject(LanguageService);
  private translate = inject(TranslateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly ranges = MONEY_RANGES;
  readonly formatPrice = (value: number) => formatPrice(value);
  readonly formatAxis = (value: number) => formatPrice(value, '1.0-0');

  readonly range = signal<MoneyRange>(30);
  readonly status = signal<EntryStatus | ''>('');
  readonly pageIndex = signal(1);
  readonly earnings = signal<SellerEarnings | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

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
    const earnings = this.earnings();
    return earnings ? trendPoints(earnings.series, (p) => p.seller, this.locale()) : [];
  });

  readonly pages = computed(() => {
    const earnings = this.earnings();
    return earnings ? Math.max(1, Math.ceil(earnings.count / earnings.size)) : 1;
  });

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.sellerService
      .getEarnings({ ...rangeQuery(this.range()), status: this.status(), page: this.pageIndex(), size: PAGE_SIZE })
      .subscribe({
        next: (earnings) => {
          this.earnings.set(earnings);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  setRange(range: MoneyRange) {
    this.range.set(range);
    this.pageIndex.set(1);
    this.load();
  }

  setStatus(value: string) {
    this.status.set(value as EntryStatus | '');
    this.pageIndex.set(1);
    this.load();
  }

  goTo(page: number) {
    this.pageIndex.set(page);
    this.load();
  }

  rangeLabel(range: MoneyRange): string {
    return range ? `dashboard.ranges.${range}` : 'dashboard.allTime';
  }
}
