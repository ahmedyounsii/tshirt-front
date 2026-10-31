import type { TagVariant } from '../components/tag/tag.component';
import { formatPrice } from '../shared/currency.config';
import { LocalizedText } from './collection.model';
import { ProductModel } from './product.model';

// Mirrored by the server (models/Discount.js)
// "percent": value is a percentage off, "amount": value is taken off each item
export const DISCOUNT_KINDS = ['percent', 'amount'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];
// What a discount applies to: the products of some collections, of some categories,
// or some products picked one by one
export const DISCOUNT_TARGETS = ['collections', 'categories', 'products'] as const;
export type DiscountTarget = (typeof DISCOUNT_TARGETS)[number];
export const DISCOUNT_TARGET_ICONS: Record<DiscountTarget, string> = {
  collections: 'sp-icon sp-apps-grid-1',
  categories: 'sp-icon sp-folder-1',
  products: 'sp-icon sp-bag-1',
};
// Colors of the home page card; "default" follows the app's primary color
export const DISCOUNT_THEMES = ['default', 'flame', 'midnight', 'lagoon', 'violet', 'lime'] as const;
export type DiscountTheme = (typeof DISCOUNT_THEMES)[number];
export const DISCOUNT_STATUSES = ['live', 'scheduled', 'paused', 'ended'] as const;
export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];
export const DISCOUNT_STATUS_TAG: Record<DiscountStatus, TagVariant> = {
  live: 'success',
  scheduled: 'info',
  paused: 'warning',
  ended: 'neutral',
};
// "global": made by an admin (/admin/discounts), with a name and a home page card;
// "user": made by a user on their own products (/my-discounts), admins included
export const DISCOUNT_SCOPES = ['global', 'user'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];
// Same limit as the server: a product is never given away
export const MAX_PERCENT = 90;

export type DiscountCollection = { _id: string; name: string; slug: string };
// A product picked one by one; url is a server path (/uploads/...)
export type DiscountProduct = { _id: string; label: string; url: string; price?: number | null };

// A sale live between startsAt and endsAt, global or on a user's own products
export type DiscountModel = {
  _id: string;
  scope: DiscountScope;
  // Only seen in the admin (user discounts are named after their products)
  name: string;
  kind: DiscountKind;
  value: number;
  target: DiscountTarget;
  // Only the list of the target is filled
  collections: DiscountCollection[];
  categories: string[];
  products: DiscountProduct[];
  // null: live as soon as saved / until paused or deleted
  startsAt: string | null;
  endsAt: string | null;
  // Paused discounts are never applied
  enabled: boolean;
  showOnHome: boolean;
  title: LocalizedText;
  subtitle: LocalizedText;
  theme: DiscountTheme;
  // Set by the server
  status: DiscountStatus;
  productsCount: number;
  createdAt?: string;
  updatedAt?: string;
};

// What the form sends: collections and products as ids. The scope is set on creation only
export type DiscountPayload = Omit<
  DiscountModel,
  '_id' | 'status' | 'productsCount' | 'collections' | 'products' | 'createdAt' | 'updatedAt'
> & { collections: string[]; products: string[] };

// A product gets one discount at a time: the products and collections already under another
// discount that hasn't ended, by id, with the name of that discount (api/discounts/taken)
export type TakenTargets = { products: Record<string, string>; collections: Record<string, string> };

// price: before the discount, shown with the discounted one on the card's hang tag
export type DiscountPreview = { _id: string; url: string; label: string; price?: number | null };

// A live or announced discount, as sent to every visitor (api/discounts/active)
export type ActiveDiscount = Pick<
  DiscountModel,
  | '_id'
  | 'kind'
  | 'value'
  | 'target'
  | 'collections'
  | 'categories'
  | 'startsAt'
  | 'endsAt'
  | 'showOnHome'
  | 'title'
  | 'subtitle'
  | 'theme'
  | 'createdAt'
> & {
  status: Extract<DiscountStatus, 'live' | 'scheduled'>;
  // Products of its collections, or picked (empty for category discounts)
  productIds: string[];
  // A few of its products, pictured on the home page card
  previews: DiscountPreview[];
};

export type ActiveDiscountsResponse = { serverTime: string; discounts: ActiveDiscount[] };

// What the home page card shows: a live discount, or the one being edited
export type DiscountCardData = Pick<
  ActiveDiscount,
  'kind' | 'value' | 'target' | 'collections' | 'categories' | 'startsAt' | 'endsAt' | 'title' | 'subtitle' | 'theme' | 'previews' | 'createdAt'
> & { status: DiscountStatus };

// The price of a product with its best live discount
export type Sale = {
  price: number;
  original: number;
  // Percentage saved, rounded, for the badge
  off: number;
  discount: ActiveDiscount;
};

// What a sale is looked up from
export type SaleProduct = Pick<ProductModel, '_id' | 'category' | 'price'>;

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

// Same rules as the server (services/discounts.js)
export const discountStatus = (
  discount: Pick<DiscountModel, 'enabled' | 'startsAt' | 'endsAt'>,
  now = Date.now(),
): DiscountStatus => {
  if (!discount.enabled) return 'paused';
  if (discount.endsAt && new Date(discount.endsAt).getTime() <= now) return 'ended';
  if (discount.startsAt && new Date(discount.startsAt).getTime() > now) return 'scheduled';
  return 'live';
};

export const salePrice = (price: number, discount: Pick<DiscountModel, 'kind' | 'value'>): number =>
  discount.kind === 'amount'
    ? Math.max(0, roundMoney(price - discount.value))
    : roundMoney(price * (1 - discount.value / 100));

// "-30%" or "-5 DT"
export const discountBadge = (discount: Pick<DiscountModel, 'kind' | 'value'>): string =>
  discount.kind === 'percent'
    ? `-${discount.value}%`
    : `-${formatPrice(discount.value, '1.0-2')}`;

// Where the home card leads: the collection's page, the store on the category, the product's
// page, else the store
export const discountLink = (
  discount: Pick<DiscountCardData, 'target' | 'collections' | 'categories' | 'previews'>,
): { link: string; queryParams?: Record<string, string> } => {
  if (discount.target === 'collections' && discount.collections.length === 1) {
    return { link: `/collection/${discount.collections[0].slug}` };
  }
  if (discount.target === 'categories' && discount.categories.length === 1) {
    return { link: '/stores', queryParams: { category: discount.categories[0] } };
  }
  // The previews of a products discount are its products
  if (discount.target === 'products' && discount.previews.length === 1) {
    return { link: `/product/${discount.previews[0]._id}` };
  }
  return { link: '/stores' };
};
