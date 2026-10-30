// Customization of a user's store page (GET api/stores/me, or "store" of their public
// profile): empty until they change something
export interface StoreModel {
  // Banner on top of the store: the server path of an uploaded image
  // (/uploads/banners/...). DEFAULT_BANNER without one
  banner?: string;
}

// Banner of the stores without their own
export const DEFAULT_BANNER = '/assets/wallpaper/spellprint_transparent.webp';
