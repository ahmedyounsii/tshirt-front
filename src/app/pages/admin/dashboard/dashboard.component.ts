import { DecimalPipe, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth/auth.service';
import { LanguageService } from '../../../services/language.service';
import { OrdersService } from '../../../services/orders/orders.service';
import { StatsService } from '../../../services/stats/stats.service';
import {
  DashboardStats,
  StatsKpiId,
  StatsPoint,
  StatsRange,
  STATS_RANGES,
} from '../../../models/stats.model';
import { ORDER_STATUSES, ORDER_STATUS_TAG, OrderStatus } from '../../../models/order.model';
import { creatorLink } from '../../../models/user.model';
import { formatPrice } from '../../../shared/currency.config';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { PricePipe } from '../../../shared/price.pipe';
import { TagComponent } from '../../../components/tag/tag.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { TrendChartComponent, TrendPoint } from './charts/trend-chart.component';
import { DonutChartComponent, DonutSegment } from './charts/donut-chart.component';
import { SelectButtonComponent, toSelectOptions } from '../../../components/selectbutton/selectbutton.component';

type Kpi = {
  id: StatsKpiId;
  icon: string;
  tone: string;
  value: string;
  // Same figure over the period before
  previous: string;
  // Change vs the period before, in %; null when there is nothing to compare with
  delta: number | null;
  // Nothing before, something now
  isNew: boolean;
};

// Each status keeps the color of its tag elsewhere in the app, and always its name
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'var(--sp-amber-500)',
  confirmed: 'var(--sp-blue-500)',
  shipped: 'var(--sp-indigo-500)',
  delivered: 'var(--sp-green-500)',
  cancelled: 'var(--sp-red-500)',
};

const KPI_ICONS: Record<StatsKpiId, string> = {
  revenue: 'pi pi-wallet',
  orders: 'pi pi-shopping-bag',
  averageOrder: 'pi pi-receipt',
  customers: 'pi pi-user-plus',
};

// Color of each figure, on its tile and on the big chart when it's drawn there
// (never the status colors)
const KPI_TONES: Record<StatsKpiId, string> = {
  revenue: 'var(--sp-primary-500)',
  orders: 'var(--sp-sky-500)',
  averageOrder: 'var(--sp-violet-500)',
  customers: 'var(--sp-pink-500)',
};

const RANGE_KEY = 'admin-dashboard-range';

// Average basket of a point of the chart (0 without orders)
const averageOf = (p: StatsPoint) => (p.orders ? p.revenue / p.orders : 0);

const METRIC_VALUES: Record<StatsKpiId, (p: StatsPoint) => number> = {
  revenue: (p) => p.revenue,
  orders: (p) => p.orders,
  averageOrder: averageOf,
  customers: (p) => p.users,
};

// Home of the admin view: the shop's figures over a period picked at the top (sales,
// orders, average basket, new customers, each against the period before), their
// trend, the orders by status, the best sellers and the latest orders
@Component({
    selector: 'app-dashboard',
    imports: [
        SelectButtonComponent,
        DecimalPipe,
        NgTemplateOutlet,
        RouterModule,
        TranslatePipe,
        SkeletonComponent,
        AvatarUrlPipe,
        PricePipe,
        TagComponent,
        IconComponent,
        TrendChartComponent,
        DonutChartComponent,
    ],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private statsService = inject(StatsService);
  private ordersService = inject(OrdersService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  auth = inject(AuthService);

  readonly rangeOptions = toSelectOptions(STATS_RANGES, (r) => `dashboard.ranges.${r}`);
  readonly statusTag = ORDER_STATUS_TAG;
  readonly baseUrl = environment.baseUrl;
  readonly creatorLink = creatorLink;

  readonly range = signal<StatsRange>(this.readRange());
  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  // Figure drawn by the big chart, picked from the tiles
  readonly metric = signal<StatsKpiId>('revenue');
  // Status highlighted in the ring and its legend
  readonly activeStatus = signal<string | null>(null);

  readonly pendingOrders = computed(() => this.ordersService.pendingCount());

  private locale = computed(() => (this.language.current() === 'fr' ? 'fr-FR' : 'en-GB'));

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return {
      key: `dashboard.greeting.${part}`,
      name: this.auth.user()?.name.split(' ')[0] ?? '',
    };
  });

  readonly today = computed(() =>
    new Intl.DateTimeFormat(this.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
  );

  readonly kpis = computed<Kpi[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    const { kpis } = stats;
    const money = (v: number) => formatPrice(v, v >= 1000 ? '1.0-0' : '1.0-2');
    const count = (v: number) => this.compact(v);
    const formats: Record<StatsKpiId, (v: number) => string> = {
      revenue: money,
      orders: count,
      averageOrder: money,
      customers: count,
    };
    return (Object.keys(KPI_ICONS) as StatsKpiId[]).map((id) => {
      const { value, previous } = kpis[id];
      return {
        id,
        icon: KPI_ICONS[id],
        tone: KPI_TONES[id],
        value: formats[id](value),
        previous: formats[id](previous),
        delta: previous ? ((value - previous) / previous) * 100 : null,
        isNew: !previous && value > 0,
      };
    });
  });

  readonly metricTone = computed(() => KPI_TONES[this.metric()]);

  readonly metricFormat = computed<(v: number) => string>(() =>
    this.metric() === 'revenue' || this.metric() === 'averageOrder'
      ? (v) => formatPrice(v, '1.0-2')
      : (v) => String(Math.round(v)),
  );

  readonly axisFormat = computed<(v: number) => string>(() => (v) => this.compact(v));

  readonly chartPoints = computed<TrendPoint[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    const short = new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'short' });
    const long = new Intl.DateTimeFormat(this.locale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const weekly = stats.range.step === 7;
    const value = METRIC_VALUES[this.metric()];
    return stats.series.map((point, i) => {
      const date = this.dateOf(point.date);
      // A week ends the day before the next one, the last one today
      const next = stats.series[i + 1];
      const end = next ? this.dateOf(next.date, -1) : this.dateOf(point.date, 6);
      const label = weekly
        ? `${short.format(date)} – ${short.format(end)}`
        : long.format(date);
      return { short: short.format(date), label, value: value(point) };
    });
  });

  readonly chartEmpty = computed(() => this.chartPoints().every((p) => !p.value));

  readonly periodOrders = computed(() => {
    const statuses = this.stats()?.statuses;
    return statuses ? ORDER_STATUSES.reduce((sum, s) => sum + statuses[s], 0) : 0;
  });

  readonly statusSegments = computed<(DonutSegment & { share: number })[]>(() => {
    const statuses = this.stats()?.statuses;
    if (!statuses) return [];
    const total = this.periodOrders();
    return ORDER_STATUSES.map((status) => ({
      key: status,
      label: this.translate.instant(`orders.status.${status}`),
      value: statuses[status],
      color: STATUS_COLORS[status],
      share: total ? (statuses[status] / total) * 100 : 0,
    }));
  });

  readonly sizes = computed(() => {
    const sizes = this.stats()?.sizes ?? [];
    const max = Math.max(...sizes.map((s) => s.quantity), 0);
    const total = sizes.reduce((sum, s) => sum + s.quantity, 0);
    return {
      total,
      rows: sizes.map((s) => ({
        ...s,
        width: max ? (s.quantity / max) * 100 : 0,
        top: max > 0 && s.quantity === max,
      })),
    };
  });

  // Two part splits drawn as one bar: delivery methods, product types
  readonly delivery = computed(() => {
    const d = this.stats()?.delivery ?? {};
    return this.split([
      { key: 'standard', label: 'checkout.delivery.standard.title', value: d.standard ?? 0 },
      { key: 'express', label: 'checkout.delivery.express.title', value: d.express ?? 0 },
    ]);
  });

  readonly productTypes = computed(() =>
    this.split(
      (this.stats()?.productTypes ?? []).map((t) => ({
        key: t.type,
        label: `gallery.types.${t.type}`,
        value: t.count,
      })),
    ),
  );

  readonly topProducts = computed(() => {
    const products = this.stats()?.topProducts ?? [];
    const max = Math.max(...products.map((p) => p.quantity), 0);
    return products.map((p) => ({ ...p, width: max ? (p.quantity / max) * 100 : 0 }));
  });

  readonly catalog = computed(() => {
    const totals = this.stats()?.totals;
    if (!totals) return [];
    return [
      // Tones tell the tiles apart at a glance, next to their names (never the status colors)
      { key: 'products', icon: 'pi pi-bookmark', tone: 'var(--sp-primary-500)', value: totals.products, link: '/admin/saved-products' },
      { key: 'designs', icon: 'pi pi-images', tone: 'var(--sp-violet-500)', value: totals.designs, link: '/admin/designs' },
      { key: 'collections', icon: 'pi pi-th-large', tone: 'var(--sp-sky-500)', value: totals.collections, link: '/admin/collections' },
      { key: 'users', icon: 'pi pi-users', tone: 'var(--sp-pink-500)', value: totals.users, link: null },
    ];
  });

  ngOnInit() {
    // The session is only known in the browser (the route never renders on the server)
    if (this.isBrowser) this.load();
  }

  setRange(range: StatsRange) {
    if (range === this.range()) return;
    this.range.set(range);
    try {
      localStorage.setItem(RANGE_KEY, String(range));
    } catch {
      // Storage blocked: the default period comes back after a reload
    }
    this.load();
  }

  // The figures shown stay on screen, dimmed, while the new ones load
  load() {
    this.loading.set(true);
    this.error.set(false);
    this.ordersService.refreshPendingCount();
    this.statsService.getDashboard(this.range()).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  // 5 min ago, 3 h ago, yesterday...
  relativeTime(iso: string): string {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    const format = new Intl.RelativeTimeFormat(this.locale(), { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(0, 'minute');
  }

  // Key of the singular ("...One") for a count of 1
  plural(key: string, count: number): string {
    return count === 1 ? `${key}One` : key;
  }

  absDelta(delta: number): string {
    const value = Math.abs(delta);
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)}%`;
  }

  private compact(value: number): string {
    return new Intl.NumberFormat(this.locale(), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  private split(parts: { key: string; label: string; value: number }[]) {
    const total = parts.reduce((sum, p) => sum + p.value, 0);
    return {
      total,
      parts: parts.map((p, i) => ({
        ...p,
        slot: i + 1,
        share: total ? (p.value / total) * 100 : 0,
      })),
    };
  }

  // YYYY-MM-DD as a local date, plus some days
  private dateOf(day: string, plusDays = 0): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d + plusDays);
  }

  private readRange(): StatsRange {
    if (!this.isBrowser) return 30;
    try {
      const stored = Number(localStorage.getItem(RANGE_KEY));
      return (STATS_RANGES as readonly number[]).includes(stored) ? (stored as StatsRange) : 30;
    } catch {
      return 30;
    }
  }
}
