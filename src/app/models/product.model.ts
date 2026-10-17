import { DesignSide, SavedDesignObject } from './design-object.model';
import { TemplateModel } from './template.model';
import { UserModel } from './user.model';

export type CanvasSize = {
  width: number;
  height: number;
};

// Print zone (the canvas) relative to the template image, as fractions of its size
export type SavedPrintArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// Kinds of products the shop makes (mirrored by the server, models/Product.js)
export const PRODUCT_TYPES = ['tshirt', 'sweatshirt'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

// Product type made from a template ('t-shirt' templates make "tshirt" products)
export const productTypeOf = (template: Pick<TemplateModel, 'type' | 'style'>): ProductType =>
  template.type === 'sweatshirt' || template.style === 'sweatshirt' ? 'sweatshirt' : 'tshirt';

export type ProductModel = {
  _id?: string;
  // Set by the server, "tshirt" when not sent
  type?: ProductType;
  url: string;
  // Capture of the back, only set when the back has designs
  backUrl?: string;
  label: string;
  color?: string;
  category?: string;
  designs?: string[];
  // Price charged, computed by the server from the price list (or the custom price);
  // null when not for sale
  price?: number | null;
  // Set by an admin to override the price list; null follows it
  customPrice?: number | null;
  // Designer state at save time
  templateId?: string;
  // Snapshot of the template, still readable if the template list changes
  template?: TemplateModel;
  canvas?: CanvasSize;
  // Where the canvas sits on each captured side of the template
  printAreas?: Partial<Record<DesignSide, SavedPrintArea>>;
  objects?: SavedDesignObject[];
  // Who saved the product; missing for anonymous/older saves. Set by the server
  createdBy?: ProductCreator;
  createdAt?: string;
};

export type ProductCreator = Pick<UserModel, '_id' | 'name' | 'username' | 'role'>;

// Mirrors the server rule: the creator or an admin can delete a product
export const canDeleteProduct = (
  product: Pick<ProductModel, 'createdBy'>,
  user: Pick<UserModel, '_id' | 'role'> | null,
): boolean =>
  user?.role === 'admin' ||
  (!!user && !!product.createdBy && product.createdBy._id === user._id);

// What the designer sends when saving a product
export type ProductPayload = Omit<
  ProductModel,
  '_id' | 'url' | 'backUrl' | 'createdBy' | 'createdAt'
>;
