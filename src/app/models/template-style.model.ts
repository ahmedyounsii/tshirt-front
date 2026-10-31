import type { Language } from '../services/language.service';

export type LocalizedText = Record<Language, string>;

// A kind of template the shop sells, managed by admins (tshirt-server models/TemplateStyle.js):
// each one has its own base price and groups the templates of the designer
export type TemplateStyle = {
  // Fixed once created: templates, products and the price list refer to it
  key: string;
  // Product type grouping styles in the designer: "t-shirt", "sweatshirt"...
  type: string;
  names: LocalizedText;
  // Shared by every style of the type
  typeNames: LocalizedText;
  // Empty when not set
  hints: LocalizedText;
};

// What the admin fills in; type is left out to create a new one from typeNames.en
export type TemplateStylePayload = {
  type?: string;
  names: LocalizedText;
  typeNames: LocalizedText;
  hints: LocalizedText;
};
