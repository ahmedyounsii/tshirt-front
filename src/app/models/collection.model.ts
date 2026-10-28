import { Language } from '../services/language.service';
import { ProductModel } from './product.model';
import { UserModel } from './user.model';

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

// A themed set of saved products made by any user (mirrored by the server,
// models/Collection.js). Its products are sold in the store as usual.
export type CollectionModel = Record<CollectionTextKey, LocalizedText> & {
  _id: string;
  // Shown as is (Marvel, Dragon Ball...) in the texts shared by every collection page
  name: string;
  // Landing page: /collection/<slug>
  slug: string;
  // Picture faded behind the showcase (server path)
  wallpaper?: string;
  // Listed on /collections and the home page; a draft is only seen by its
  // maker and the admins
  published: boolean;
  // Shown on the home page; only one collection at a time, picked by an admin
  featured: boolean;
  // User who made it: they and the admins can edit it. Unset on the collections
  // made before users could make their own, which only admins can edit
  createdBy?: Pick<UserModel, '_id' | 'name' | 'username' | 'role'>;
  // In the order the admin picked them: the first ones are on the showcase
  products: CollectionProduct[];
  createdAt?: string;
  updatedAt?: string;
};

// What the admin form sends: products as ids, in their order
export type CollectionPayload = Omit<
  CollectionModel,
  '_id' | 'wallpaper' | 'products' | 'createdBy' | 'createdAt' | 'updatedAt'
> & { products: string[] };

export const emptyText = (): LocalizedText => ({ fr: '', en: '' });

// The text in the current language, else in the other one
export const localized = (text: LocalizedText | undefined, lang: Language): string =>
  text?.[lang] || text?.fr || text?.en || '';

export const collectionLink = (collection: Pick<CollectionModel, 'slug'>) =>
  `/collection/${collection.slug}`;

// Mirrors the server rule: admins edit and delete every collection, users only the ones they
// made (collections made before users could make their own have no maker: admins only)
export const canEditCollection = (
  collection: Pick<CollectionModel, 'createdBy'>,
  user: Pick<UserModel, '_id' | 'role'> | null,
): boolean =>
  user?.role === 'admin' ||
  (!!user && !!collection.createdBy && collection.createdBy._id === user._id);

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
