import { OrderStatus } from './order.model';
import { ProductType } from './product.model';
import { UserModel } from './user.model';

// Periods of the admin dashboard, in days
export const STATS_RANGES = [7, 30, 90, 365] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

// A figure of the period and the same span just before it
export type StatsKpi = { value: number; previous: number };

export type StatsKpiId = 'revenue' | 'orders' | 'averageOrder' | 'customers';

// One day, or one week (step 7) named after its first day (YYYY-MM-DD)
export type StatsPoint = {
  date: string;
  revenue: number;
  orders: number;
  users: number;
};

export type StatsTopProduct = {
  _id: string;
  label: string;
  url: string;
  quantity: number;
  revenue: number;
};

export type StatsTopCreator = Pick<UserModel, '_id' | 'name' | 'username' | 'avatar' | 'role'> & {
  products: number;
};

export type StatsRecentOrder = {
  _id: string;
  number: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  customer: string;
  quantity: number;
  url: string | null;
};

// GET api/stats (admin): cancelled orders are left out of every sales figure
export type DashboardStats = {
  range: { days: StatsRange; step: 1 | 7; from: string; to: string; timeZone: string };
  kpis: Record<StatsKpiId | 'itemsSold', StatsKpi>;
  totals: {
    users: number;
    products: number;
    designs: number;
    collections: number;
    orders: number;
    revenue: number;
  };
  series: StatsPoint[];
  // Every order placed in the period, cancelled ones included
  statuses: Record<OrderStatus, number>;
  sizes: { size: string; quantity: number }[];
  delivery: Partial<Record<'standard' | 'express', number>>;
  productTypes: { type: ProductType; count: number }[];
  topProducts: StatsTopProduct[];
  topCreators: StatsTopCreator[];
  recentOrders: StatsRecentOrder[];
};
