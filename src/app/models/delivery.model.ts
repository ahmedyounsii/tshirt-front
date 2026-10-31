// A delivery option set by the admins (api/delivery), chosen at checkout
export type DeliveryOption = {
  id: string;
  // Empty on the default options: their name is translated (checkout.delivery.<id>.title)
  name: string;
  // Business days after the order
  minDays: number;
  maxDays: number;
  price: number;
  // Free from this subtotal, null when never free
  freeFrom: number | null;
};

export type DeliverySettings = {
  // False until an admin saved the options: the defaults apply
  configured: boolean;
  options: DeliveryOption[];
  updatedAt: string | null;
};

// Same limit as the server (services/delivery.js)
export const MAX_DELIVERY_OPTIONS = 3;

// The server's defaults, shown until the options are loaded. Orders placed before the
// options were configurable are read with them ("standard" / "express")
export const DEFAULT_DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: 'standard', name: '', minDays: 3, maxDays: 5, price: 4.99, freeFrom: 50 },
  { id: 'express', name: '', minDays: 1, maxDays: 2, price: 9.99, freeFrom: null },
];
