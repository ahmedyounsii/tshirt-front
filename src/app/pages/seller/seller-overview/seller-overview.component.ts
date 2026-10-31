import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { SellerOverview, SeriesPoint } from '../../../models/seller.model';
import { AuthService } from '../../../services/auth/auth.service';
import { LanguageService } from '../../../services/language.service';
import { SellerService } from '../../../services/seller/seller.service';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { formatPrice } from '../../../shared/currency.config';
import { toneOf, trendPoints } from '../../../shared/marketplace';
import { PricePipe } from '../../../shared/price.pipe';
import { TrendChartComponent } from '../../admin/dashboard/charts/trend-chart.component';

// Same periods as the admin dashboard
const RANGES = [7, 30, 90, 365] as const;
const METRICS = ['gross', 'seller'] as const;
type Metric = (typeof METRICS)[number];
const METRIC_VALUE: Record<Metric, (p: SeriesPoint) => number> = {
  gross: (p) => p.gross,
  seller: (p) => p.seller,
};

// Home of the seller dashboard: sales and earnings of the period, the money waiting (unpaid
// orders) and available, the catalog, orders to follow and the best sellers. Real figures
// from the commission ledger only
@Component({
  selector: 'app-seller-overview',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe, SkeletonModule, EmptyComponent, TrendChartComponent, AvatarUrlPipe, PricePipe],
  templateUrl: './seller-overview.component.html',
  styleUrl: './seller-overview.component.scss',
})
export class SellerOverviewComponent implements OnInit {
  private sellerService = inject(SellerService);
  private language = inject(LanguageService);
  readonly auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly ranges = RANGES;
  readonly metrics = METRICS;
  readonly toneOf = toneOf;
  readonly formatPrice = (value: number) => formatPrice(value);
  readonly formatAxis = (value: number) => formatPrice(value, '1.0-0');

  readonly range = signal<(typeof RANGES)[number]>(30);
  readonly metric = signal<Metric>('gross');
  readonly overview = signal<SellerOverview | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  private locale = computed(() => (this.language.current() === 'fr' ? 'fr-FR' : 'en-GB'));

  readonly points = computed(() => {
    const overview = this.overview();
    return overview ? trendPoints(overview.series, METRIC_VALUE[this.metric()], this.locale()) : [];
  });

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.sellerService.getOverview(this.range()).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  setRange(range: (typeof RANGES)[number]) {
    this.range.set(range);
    this.load();
  }
}
