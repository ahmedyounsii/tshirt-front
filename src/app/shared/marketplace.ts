import { TrendPoint } from '../pages/admin/dashboard/charts/trend-chart.component';
import { LedgerSeries, SeriesPoint } from '../models/seller.model';

// Helpers shared by the marketplace pages (admin and seller dashboard)

export type Tone = 'warn' | 'ok' | 'info' | 'bad' | '';

// Color of a status pill (applications, codes, ledger entries, orders, sellers)
const TONES: Record<string, Tone> = {
  pending: 'warn',
  estimated: 'warn',
  approved: 'info',
  confirmed: 'info',
  shipped: 'info',
  unused: 'info',
  settled: 'info',
  eligible: 'ok',
  delivered: 'ok',
  active: 'ok',
  activated: 'ok',
  rejected: 'bad',
  cancelled: 'bad',
  void: 'bad',
  revoked: 'bad',
  suspended: 'bad',
  closed: 'bad',
  paused: 'warn',
};

export const toneOf = (status?: string | null): Tone => (status && TONES[status]) || '';

// Points of the trend chart from a ledger series: per day (28 Oct) or per month (Oct 2026)
export const trendPoints = (
  series: LedgerSeries,
  value: (point: SeriesPoint) => number,
  locale: string,
): TrendPoint[] => {
  const daily = series.unit === 'day';
  const short = new Intl.DateTimeFormat(locale, daily ? { day: 'numeric', month: 'short' } : { month: 'short' });
  const long = new Intl.DateTimeFormat(
    locale,
    daily ? { weekday: 'short', day: 'numeric', month: 'short' } : { month: 'long', year: 'numeric' },
  );
  return series.points.map((point) => {
    const [y, m, d] = point.date.split('-').map(Number);
    const date = new Date(y, m - 1, d || 1);
    return { short: short.format(date), label: long.format(date), value: value(point) };
  });
};

// Copies text to the clipboard; false when the browser refuses
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
