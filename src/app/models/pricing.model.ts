import { ProductCreator } from './product.model';

// Key of one of the admins' template styles (see TemplateStylesService), each with its own
// base price
export type ProductStyle = string;

// The shop's price list: a product costs its style's price plus each design and text printed on it
export type PricingModel = {
  // False until an admin saved the price list once
  configured: boolean;
  // Every style, in the shop's order; null: the style isn't for sale
  styles: Record<ProductStyle, number | null>;
  designPrice: number;
  textPrice: number;
  updatedAt: string | null;
};

export type PricingStats = {
  total: number;
  // Products with a custom price, which ignore the price list
  custom: number;
  styles: Record<ProductStyle, { total: number; custom: number }>;
};

// A product whose price was set by hand, with the one the price list would give it
export type CustomPricedProduct = {
  _id: string;
  label: string;
  url: string;
  style: ProductStyle;
  price: number | null;
  customPrice: number;
  autoPrice: number | null;
  createdBy?: ProductCreator;
};

export type PricingSaveResult = {
  pricing: PricingModel;
  // Products whose price changed
  repriced: number;
  stats: PricingStats;
};

export type PriceBreakdown = {
  style: ProductStyle;
  base: number;
  designs: number;
  designsTotal: number;
  texts: number;
  textsTotal: number;
  total: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

// Products saved before templates were recorded were made on a regular one
export const styleOf = (style?: string | null): ProductStyle => style || 'regular';

// Same computation as the server (services/pricing.js); null when the style isn't priced
export const priceBreakdown = (
  pricing: Pick<PricingModel, 'styles' | 'designPrice' | 'textPrice'>,
  style: ProductStyle,
  designs: number,
  texts: number,
): PriceBreakdown | null => {
  const base = pricing.styles[style] ?? null;
  if (base == null) return null;
  const designsTotal = roundMoney(designs * (pricing.designPrice || 0));
  const textsTotal = roundMoney(texts * (pricing.textPrice || 0));
  return {
    style,
    base,
    designs,
    designsTotal,
    texts,
    textsTotal,
    total: roundMoney(base + designsTotal + textsTotal),
  };
};
