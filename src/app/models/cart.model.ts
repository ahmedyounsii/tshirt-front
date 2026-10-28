import { ProductModel } from './product.model';

// Same sizes and limit as the server (models/ShopCart.js)
export const PRODUCT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type ProductSize = (typeof PRODUCT_SIZES)[number];
export const MAX_QUANTITY = 20;

// What a cart line shows of its product; urls are absolute (baseUrl added).
// The designer state draws its preview, the category finds its discount
export type CartProduct = Pick<
  ProductModel,
  | 'label'
  | 'category'
  | 'url'
  | 'backUrl'
  | 'price'
  | 'templateId'
  | 'template'
  | 'canvas'
  | 'printAreas'
  | 'objects'
> & { _id: string };

// One product in one size: the same product in two sizes is two lines
export type CartItem = {
  product: CartProduct;
  size: ProductSize;
  quantity: number;
  addedAt?: string;
};

// Response of api/cart
export type CartResponse = {
  items: CartItem[];
  updatedAt?: string;
};

// A size and how many of it, as picked in the "Shop now" dialog
export type SizeQuantity = {
  size: ProductSize;
  quantity: number;
};

export const cartItemKey = (item: { product: { _id: string } | string; size: string }) =>
  `${typeof item.product === 'string' ? item.product : item.product._id}:${item.size}`;
