import { DeliveryMethod } from '../models/order.model';
import { ProductSize } from '../models/cart.model';

// Mirrors the server (routes/orderRoutes.js), which computes what is actually charged
export const FREE_SHIPPING_FROM = 50;

export type DeliveryOption = {
  id: DeliveryMethod;
  cost: number;
  // Free from FREE_SHIPPING_FROM
  freeAbove: boolean;
  // Business days after the order
  minDays: number;
  maxDays: number;
  icon: string;
};

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: 'standard', cost: 4.99, freeAbove: true, minDays: 3, maxDays: 5, icon: 'pi pi-truck' },
  { id: 'express', cost: 9.99, freeAbove: false, minDays: 1, maxDays: 2, icon: 'pi pi-bolt' },
];

export const shippingCost = (option: DeliveryOption, subtotal: number): number =>
  option.freeAbove && subtotal >= FREE_SHIPPING_FROM ? 0 : option.cost;

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
export const arrivalRange = (option: DeliveryOption, from: Date, locale: string): string => {
  const format = (date: Date) =>
    date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${format(addBusinessDays(from, option.minDays))} – ${format(
    addBusinessDays(from, option.maxDays),
  )}`;
};

export const deliveryOptionOf = (id: DeliveryMethod): DeliveryOption =>
  DELIVERY_OPTIONS.find((o) => o.id === id) ?? DELIVERY_OPTIONS[0];

// Approximate body measurements (cm) shown in the size guide
export const SIZE_GUIDE: Record<ProductSize, { chest: string; length: number }> = {
  XS: { chest: '82-87', length: 66 },
  S: { chest: '88-93', length: 69 },
  M: { chest: '94-99', length: 72 },
  L: { chest: '100-105', length: 74 },
  XL: { chest: '106-111', length: 76 },
  XXL: { chest: '112-117', length: 78 },
};
