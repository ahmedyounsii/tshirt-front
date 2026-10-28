import { ProductSize } from './cart.model';
import { ProductModel } from './product.model';
import type { TagVariant } from '../components/tag/tag.component';

export type DeliveryMethod = 'standard' | 'express';
// Cash on delivery only for now
export type PaymentMethod = 'cod';
export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
// Tag color of each status (order cards, production sheet)
export const ORDER_STATUS_TAG: Record<OrderStatus, TagVariant> = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'help',
  delivered: 'success',
  cancelled: 'danger',
};

export type ShippingAddress = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
};

// Snapshot of the product at order time
export type OrderItem = {
  product: string;
  label: string;
  url: string;
  backUrl?: string;
  templateId?: string;
  size: ProductSize;
  quantity: number;
  // Charged per unit, discount included
  unitPrice: number;
  // Only on discounted items: the price before the discount, and the discount as it was
  originalPrice?: number;
  discount?: { _id: string; name: string; kind: 'percent' | 'amount'; value: number };
  // Designer state at order time, drawing the preview; missing on older orders
  print?: OrderItemPrint | null;
};

// Designer state of an ordered product: what the workshop prints
export type OrderItemPrint = Pick<ProductModel, 'template' | 'canvas' | 'printAreas' | 'objects'>;

// An item as sent by the admin print sheet route. printSource tells where its print
// data comes from: the order itself, the product as it is now (older orders), or
// nowhere (null, the product was deleted since)
export type OrderPrintItem = OrderItem & {
  print: OrderItemPrint | null;
  printSource: 'order' | 'product' | null;
};

export type OrderPrintSheet = Omit<OrderModel, 'items'> & { items: OrderPrintItem[] };

export type OrderModel = {
  _id: string;
  number: string;
  items: OrderItem[];
  shipping: ShippingAddress;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  subtotal: number;
  shippingCost: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  // Only populated in the admin list
  user?: { _id: string; name: string; username?: string; email: string } | null;
};

// Admin list: counts per status ("all" for the total) ignore the status filter
export type OrdersPage = {
  items: OrderModel[];
  count: number;
  page: number;
  size: number;
  counts: Partial<Record<OrderStatus | 'all', number>>;
};

export type OrdersQuery = {
  page: number;
  size: number;
  status?: OrderStatus;
  search?: string;
};

// What the checkout sends: the items are the user's cart, read by the server
export type OrderPayload = {
  shipping: ShippingAddress;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
};
