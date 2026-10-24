import { Language } from '../services/language.service';
import { ProductModel } from './product.model';

// A text typed by the admin in each language of the site
export type LocalizedText = Record<Language, string>;

// Texts of a collection, each typed in French and English
export const COLLECTION_TEXTS = [
  'eyebrow',
  'badge',
  'title',
  'description',
  'aboutTitle',
  'aboutText',
] as const;
export type CollectionTextKey = (typeof COLLECTION_TEXTS)[number];

// Products as sent with a collection: what the showcase and the admin list show
export type CollectionProduct = Pick<
  ProductModel,
  '_id' | 'url' | 'backUrl' | 'label' | 'price' | 'type'
>;

// A themed set of saved products made by an admin (mirrored by the server,
// models/Collection.js). Its products are sold in the store as usual.
export type CollectionModel = Record<CollectionTextKey, LocalizedText> & {
  _id: string;
  // Shown as is (Marvel, Dragon Ball...) in the texts shared by every collection page
  name: string;
  // Landing page: /collection/<slug>
  slug: string;
  // Picture faded behind the showcase (server path)
  wallpaper?: string;
  // Shown on the home page; only one collection at a time
  featured: boolean;
  // In the order the admin picked them: the first ones are on the showcase
  products: CollectionProduct[];
  createdAt?: string;
  updatedAt?: string;
};

// What the admin form sends: products as ids, in their order
export type CollectionPayload = Omit<
  CollectionModel,
  '_id' | 'wallpaper' | 'products' | 'createdAt' | 'updatedAt'
> & { products: string[] };

export const emptyText = (): LocalizedText => ({ fr: '', en: '' });

// The text in the current language, else in the other one
export const localized = (text: LocalizedText | undefined, lang: Language): string =>
  text?.[lang] || text?.fr || text?.en || '';

export const collectionLink = (collection: Pick<CollectionModel, 'slug'>) =>
  `/collection/${collection.slug}`;

// "Dragon Ball Z" -> "t-shirt-dragon-ball-z", the landing page address of a new collection
export const slugFrom = (name: string): string => {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return words ? `t-shirt-${words}` : '';
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
