import { ProductSize } from '../models/cart.model';
import { DEFAULT_DELIVERY_OPTIONS, DeliveryOption } from '../models/delivery.model';
import { OrderModel } from '../models/order.model';

// Same as the server (services/delivery.js), which computes what is actually charged
export const shippingCost = (option: DeliveryOption, subtotal: number): number =>
  option.freeFrom != null && subtotal >= option.freeFrom ? 0 : option.price;

// The fastest of several options shows a bolt, the others a truck
export const deliveryIcon = (option: DeliveryOption, options: DeliveryOption[]): string =>
  options.length > 1 && option.maxDays === Math.min(...options.map((o) => o.maxDays))
    ? 'sp-icon sp-flash'
    : 'sp-icon sp-delivery';

// The delivery an order was placed with: kept on it, or the defaults for the orders placed
// before the options were configurable
export const orderDeliveryOf = (order: Pick<OrderModel, 'delivery' | 'deliveryOption'>): DeliveryOption =>
  order.deliveryOption
    ? { id: order.delivery, ...order.deliveryOption, freeFrom: order.deliveryOption.freeFrom ?? null }
    : (DEFAULT_DELIVERY_OPTIONS.find((o) => o.id === order.delivery) ?? DEFAULT_DELIVERY_OPTIONS[0]);

// Adds business days (weekends skipped) to a date
export const addBusinessDays = (from: Date, days: number): Date => {
  const date = new Date(from);
  while (days > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) days--;
  }
  return date;
};

// e.g. "Tue, Oct 21 – Thu, Oct 23": when an order made on `from` should arrive
export const arrivalRange = (
  option: Pick<DeliveryOption, 'minDays' | 'maxDays'>,
  from: Date,
  locale: string,
): string => {
  const format = (date: Date) =>
    date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${format(addBusinessDays(from, option.minDays))} – ${format(
    addBusinessDays(from, option.maxDays),
  )}`;
};

// Approximate body measurements (cm) shown in the size guide
export const SIZE_GUIDE: Record<ProductSize, { chest: string; length: number }> = {
  XS: { chest: '82-87', length: 66 },
  S: { chest: '88-93', length: 69 },
  M: { chest: '94-99', length: 72 },
  L: { chest: '100-105', length: 74 },
  XL: { chest: '106-111', length: 76 },
  XXL: { chest: '112-117', length: 78 },
};
