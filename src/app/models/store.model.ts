// Customization of a user's store page (GET api/stores/me, or "store" of their public
// profile): empty until they change something
export interface StoreModel {
  // Banner on top of the store: the server path of an uploaded image
  // (/uploads/banners/...). DEFAULT_BANNER without one
  banner?: string;
  // Seller store identity (seller dashboard > store settings)
  name?: string;
  // Address of the store page (/store/<slug>), from its name
  slug?: string;
  description?: string;
  // /uploads/sellers/...
  logo?: string;
  // GET api/stores/me only: where the user's seller store stands, null for non-sellers
  status?: StoreStatus | null;
}

export type StoreStatus = 'active' | 'paused' | 'suspended' | 'closed';

// Only an open store is shown on the store page; paused, suspended or deleted ones show the user
export const isStoreShown = (status?: StoreStatus | null): boolean => status === 'active';

// Identity shown on top of a seller's store page instead of the user's
export interface StoreIdentity {
  name: string;
  description?: string;
  logo?: string;
}

// Active sellers with a store name show it; everyone else shows their user info
export const storeIdentityOf = (isSeller: boolean, store: StoreModel | null | undefined): StoreIdentity | null =>
  isSeller && store?.name ? { name: store.name, description: store.description, logo: store.logo } : null;

// Banner of the stores without their own
export const DEFAULT_BANNER = '/assets/wallpaper/spellprint_transparent.webp';
