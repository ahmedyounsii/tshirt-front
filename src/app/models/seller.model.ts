import { UserModel } from './user.model';

// Marketplace: seller applications, activation codes, the seller dashboard and the admin's
// commission and revenue pages (tshirt-server routes sellerApplicationRoutes, sellerRoutes,
// marketplaceRoutes). Amounts are in the shop's currency, rates in percent

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'activated';
export const APPLICATION_STATUSES: ApplicationStatus[] = ['pending', 'approved', 'rejected', 'activated'];

export interface ApplicationStep {
  status: ApplicationStatus;
  at: string;
  by?: Pick<UserModel, '_id' | 'name' | 'username'>;
  note?: string;
}

export interface SellerApplication {
  _id: string;
  // A user id for the applicant, populated in the admin
  user: string | Pick<UserModel, '_id' | 'name' | 'username' | 'email' | 'avatar' | 'createdAt' | 'seller'>;
  storeName: string;
  description?: string;
  logo?: string;
  phone?: string;
  link?: string;
  status: ApplicationStatus;
  rejectionReason?: string;
  reviewedBy?: Pick<UserModel, '_id' | 'name' | 'username'>;
  reviewedAt?: string;
  activatedAt?: string;
  history?: ApplicationStep[];
  // Activated applications (admin): the user's store as it is now, edited since maybe
  currentStore?: { name?: string; description?: string; logo?: string };
  // ...and where that store stands since: unset while active, "closed" once deleted (or
  // replaced by a later activation)
  storeStatus?: 'suspended' | 'closed';
  storeStatusAt?: string;
  createdAt: string;
}

export interface ApplicationPayload {
  storeName: string;
  description?: string;
  phone?: string;
  link?: string;
}

// "expired" is an unused code past its date
export type CodeStatus = 'unused' | 'used' | 'revoked' | 'expired';

// What anyone sees of an activation code: never the code itself
export interface CodeInfo {
  _id: string;
  hint: string;
  status: CodeStatus;
  expiresAt: string;
  createdAt: string;
  redeemedAt?: string;
  revokedAt?: string;
}

// GET api/seller-applications/mine
export interface MyApplication {
  application: SellerApplication | null;
  code: CodeInfo | null;
  seller: UserModel['seller'] | null;
}

// Approval and code (re)generation: the code is only sent in these answers
export interface IssuedCode {
  code: string;
  info: CodeInfo;
}

export interface ApplicationsPage {
  items: SellerApplication[];
  count: number;
  page: number;
  size: number;
  counts: Partial<Record<ApplicationStatus | 'all', number>>;
}

export interface ApplicationDetail {
  application: SellerApplication;
  codes: CodeInfo[];
}

// ---- Ledger

// estimated: order placed; pending: confirmed or shipped; eligible: delivered (paid);
// settled: paid out; void: cancelled before payment
export type EntryStatus = 'estimated' | 'pending' | 'eligible' | 'settled' | 'void';
export const ENTRY_STATUSES: EntryStatus[] = ['estimated', 'pending', 'eligible', 'settled', 'void'];

export interface LedgerEntry {
  _id: string;
  kind: 'sale' | 'reversal';
  seller: string | Pick<UserModel, '_id' | 'name' | 'username'>;
  order: string;
  orderNumber: string;
  itemIndex: number;
  product?: string;
  label?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  // Eligible sale amount (negative for reversals)
  gross: number;
  rate: number;
  commission: number;
  sellerAmount: number;
  currency: string;
  status: EntryStatus;
  // Reversals: "cancel:<n>" or "refund:<units>"
  reason?: string;
  payout?: string;
  settledAt?: string;
  createdAt: string;
}

// Totals of ledger entries (services/ledger.js totalsOf)
export interface LedgerTotals {
  grossSales: number;
  refunds: number;
  netSales: number;
  commission: number;
  commissionReversed: number;
  sellerEarnings: number;
  pendingCommission: number;
  collectedCommission: number;
  pendingEarnings: number;
  availableBalance: number;
  paidOut: number;
  cancelled: number;
  transactions: number;
  units: number;
}

export interface SeriesPoint {
  // 2026-10-28, or 2026-10 when unit is "month"
  date: string;
  gross: number;
  refunds: number;
  commission: number;
  seller: number;
}

export interface LedgerSeries {
  unit: 'day' | 'month';
  points: SeriesPoint[];
}

export interface Payout {
  _id: string;
  seller: string | Pick<UserModel, '_id' | 'name' | 'username'>;
  amount: number;
  currency: string;
  entries: number;
  method: 'manual';
  reference: string;
  note?: string;
  recordedBy?: Pick<UserModel, '_id' | 'name' | 'username'>;
  createdAt: string;
}

export interface DateRange {
  from: string;
  to: string;
}

// ---- Seller dashboard

export interface SellerOrderItem {
  index: number;
  product: string;
  label: string;
  url: string;
  backUrl?: string;
  size: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  discount?: { name: string; kind: string; value: number };
  refundedQuantity?: number;
  ledger: {
    rate: number;
    status: EntryStatus;
    gross: number;
    commission: number;
    sellerAmount: number;
    refunded: number;
  } | null;
}

export interface SellerOrder {
  _id: string;
  number: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  delivery: string;
  shipping: { city: string; country: string };
  items: SellerOrderItem[];
  sellerSubtotal: number;
  sellerEarnings: number;
}

export interface SellerOrdersPage {
  items: SellerOrder[];
  count: number;
  page: number;
  size: number;
  counts: Partial<Record<SellerOrder['status'] | 'all', number>>;
}

export interface ProductSales {
  units: number;
  sales: number;
  earnings: number;
}

export interface SellerProduct {
  _id: string;
  label: string;
  url: string;
  backUrl?: string;
  type: string;
  price: number | null;
  customPrice: number | null;
  published: boolean;
  category?: string;
  tags?: string[];
  createdAt?: string;
  sales: ProductSales;
  collection: { _id: string; name: string; slug: string } | null;
}

export interface SellerProductsPage {
  items: SellerProduct[];
  count: number;
  page: number;
  size: number;
  counts: { all: number; published: number; hidden: number };
}

export interface SellerDesign {
  _id: string;
  url: string;
  label: string;
  tags?: string[];
  published: boolean;
  usedCount: number;
  categoryIds?: string[];
  products: { _id: string; label: string; url: string; mine: boolean }[];
}

export interface SellerDesignsPage {
  items: SellerDesign[];
  count: number;
  page: number;
  size: number;
}

export interface SellerOverview {
  range: { days: number; from: string; to: string };
  catalog: {
    products: number;
    publishedProducts: number;
    designs: number;
    publishedDesigns: number;
    collections: number;
    activePromotions: number;
  };
  totals: LedgerTotals;
  period: LedgerTotals & { orders: number };
  series: LedgerSeries;
  pendingOrders: number;
  recentOrders: SellerOrder[];
  topProducts: (ProductSales & { _id: string; label?: string; url?: string })[];
  topDesigns: { _id: string; label: string; url: string; units: number }[];
  rate: number;
}

export interface SellerEarnings {
  rate: number;
  customRate: boolean;
  range: DateRange;
  period: LedgerTotals;
  balances: LedgerTotals;
  series: LedgerSeries;
  items: LedgerEntry[];
  count: number;
  page: number;
  size: number;
  payouts: Payout[];
}

// ---- Admin

export interface CommissionSettings {
  defaultRate: number;
  updatedAt: string | null;
  updatedBy: Pick<UserModel, '_id' | 'name' | 'username'> | null;
}

export interface SellerSummary {
  _id: string;
  name: string;
  username?: string;
  email: string;
  avatar?: string;
  status: 'active' | 'suspended' | 'closed';
  activatedAt?: string;
  suspendedAt?: string;
  suspendedReason?: string;
  // Paused by the seller
  paused?: boolean;
  closedAt?: string;
  closedBySelf?: boolean;
  closedReason?: string;
  // Effective rate, and the seller's own one (null: the default)
  rate: number;
  customRate: number | null;
  storeName: string | null;
  storeLogo: string | null;
  totals?: LedgerTotals | null;
  payouts?: Payout[];
}

export interface SellersPage {
  items: SellerSummary[];
  count: number;
  page: number;
  size: number;
  counts: Partial<Record<'active' | 'suspended' | 'closed' | 'all', number>>;
}

export interface Revenue {
  range: DateRange;
  summary: LedgerTotals;
  series: LedgerSeries;
  sellers: (SellerSummary & { totals: LedgerTotals })[];
  activeSellers: number;
  defaultRate: number;
}

export interface LedgerPage {
  items: LedgerEntry[];
  count: number;
  page: number;
  size: number;
}

export interface AuditEntry {
  _id: string;
  actor?: Pick<UserModel, '_id' | 'name' | 'username'>;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditPage {
  items: AuditEntry[];
  count: number;
  page: number;
  size: number;
}

// Filters of the ledger based pages
export interface LedgerQuery {
  from?: string;
  to?: string;
  status?: EntryStatus | '';
  seller?: string;
  page?: number;
  size?: number;
}

// Periods offered by the money pages, in days; 0 is everything
export const MONEY_RANGES = [7, 30, 90, 365, 0] as const;
export type MoneyRange = (typeof MONEY_RANGES)[number];

// from/to of a period ending now: from midnight `days` days ago, in the browser's time zone
export const rangeQuery = (days: MoneyRange): { from?: string } => {
  if (!days) return {};
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days + 1);
  return { from: from.toISOString() };
};

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};
