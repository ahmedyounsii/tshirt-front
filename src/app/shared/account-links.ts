// Pages of the account, listed in the account menu of the header
export type AccountLinkId =
  | 'products'
  | 'favorites'
  | 'orders'
  | 'dashboard'
  | 'designs'
  | 'designCategories'
  | 'designList'
  | 'templates'
  | 'savedProducts'
  | 'collections'
  | 'manageOrders'
  | 'discounts'
  | 'pricing'
  | 'delivery'
  | 'admins'
  | 'becomeSeller'
  | 'sellerApplications'
  | 'sellers'
  | 'commission'
  | 'revenue'
  | 'audit'
  | 'sellerOverview'
  | 'sellerDesigns'
  | 'sellerProducts'
  | 'sellerCollections'
  | 'sellerPromotions'
  | 'sellerOrders'
  | 'sellerEarnings'
  | 'sellerStore';

export interface AccountLink {
  id: AccountLinkId;
  label: string;
  icon: string;
  link: string;
  // Shown under that link, which opens to list them
  parent?: AccountLinkId;
}

// Every user
export const USER_LINKS: AccountLink[] = [
  {
    id: 'products',
    label: 'common.myDesigns',
    icon: 'sp-icon sp-color-palette',
    link: '/my_store',
  },
  {
    id: 'favorites',
    label: 'common.myFavorites',
    icon: 'sp-icon sp-heart-1',
    link: '/favorites',
  },
  {
    id: 'orders',
    label: 'common.myOrders',
    icon: 'sp-icon sp-box-1',
    link: '/orders',
  },
  // Until seller access is active; sellers reach their dashboard from the header button
  // (app-header-seller), where their promotions are too
  {
    id: 'becomeSeller',
    label: 'seller.links.becomeSeller',
    icon: 'sp-icon sp-briefcase-1',
    link: '/become-seller',
  },
];

// Admins only, their own pages under /admin (the sidebar of the admin view)
export const ADMIN_LINKS: AccountLink[] = [
  {
    id: 'dashboard',
    label: 'adminView.dashboard',
    icon: 'sp-icon sp-bar-chart-1',
    link: '/admin',
  },
  {
    id: 'designs',
    label: 'common.manageDesigns',
    icon: 'sp-icon sp-image-album',
    link: '/admin/designs',
  },
  {
    id: 'designCategories',
    label: 'common.categories',
    icon: 'sp-icon sp-folder-1',
    link: '/admin/designs/categories',
    parent: 'designs',
  },
  {
    id: 'designList',
    label: 'common.designs',
    icon: 'sp-icon sp-image-1',
    link: '/admin/designs',
    parent: 'designs',
  },
  {
    id: 'templates',
    label: 'admin.templates.title',
    icon: 'sp-icon sp-box-1',
    link: '/admin/designs/templates',
    parent: 'designs',
  },
  {
    id: 'savedProducts',
    label: 'common.savedProducts',
    icon: 'sp-icon sp-bookmark',
    link: '/admin/saved-products',
  },
  {
    id: 'collections',
    label: 'common.manageCollections',
    icon: 'sp-icon sp-apps-grid-1',
    link: '/admin/collections',
  },
  {
    id: 'manageOrders',
    label: 'common.manageOrders',
    icon: 'sp-icon sp-inbox-1',
    link: '/admin/orders',
  },
  {
    id: 'discounts',
    label: 'common.manageDiscounts',
    icon: 'sp-icon sp-discount-badge',
    link: '/admin/discounts',
  },
  {
    id: 'pricing',
    label: 'common.pricing',
    icon: 'sp-icon sp-tag-1',
    link: '/admin/pricing',
  },
  {
    id: 'delivery',
    label: 'common.delivery',
    icon: 'sp-icon sp-delivery',
    link: '/admin/delivery',
  },
  // Marketplace
  {
    id: 'sellerApplications',
    label: 'seller.links.applications',
    icon: 'sp-icon sp-user-id',
    link: '/admin/seller-applications',
  },
  {
    id: 'sellers',
    label: 'seller.links.sellers',
    icon: 'sp-icon sp-users',
    link: '/admin/sellers',
  },
  {
    id: 'commission',
    label: 'seller.links.commission',
    icon: 'sp-icon sp-discount-badge',
    link: '/admin/commission',
  },
  {
    id: 'revenue',
    label: 'seller.links.revenue',
    icon: 'sp-icon sp-wallet-1',
    link: '/admin/revenue',
  },
  {
    id: 'audit',
    label: 'seller.links.audit',
    icon: 'sp-icon sp-history-1',
    link: '/admin/audit',
  },
  // Super admin only
  {
    id: 'admins',
    label: 'adminView.admins',
    icon: 'sp-icon sp-shield-1',
    link: '/admin/admins',
  },
];

// Seller dashboard pages under /seller (its sidebar)
export const SELLER_LINKS: AccountLink[] = [
  {
    id: 'sellerOverview',
    label: 'seller.links.overview',
    icon: 'sp-icon sp-bar-chart-1',
    link: '/seller',
  },
  {
    id: 'sellerDesigns',
    label: 'seller.links.designs',
    icon: 'sp-icon sp-image-album',
    link: '/seller/designs',
  },
  {
    id: 'sellerProducts',
    label: 'seller.links.products',
    icon: 'sp-icon sp-tags',
    link: '/seller/products',
  },
  {
    id: 'sellerCollections',
    label: 'seller.links.collections',
    icon: 'sp-icon sp-apps-grid-1',
    link: '/seller/collections',
  },
  {
    id: 'sellerPromotions',
    label: 'seller.links.promotions',
    icon: 'sp-icon sp-discount-badge',
    link: '/seller/promotions',
  },
  {
    id: 'sellerOrders',
    label: 'seller.links.orders',
    icon: 'sp-icon sp-inbox-1',
    link: '/seller/orders',
  },
  {
    id: 'sellerEarnings',
    label: 'seller.links.earnings',
    icon: 'sp-icon sp-wallet-1',
    link: '/seller/earnings',
  },
  {
    id: 'sellerStore',
    label: 'seller.links.store',
    icon: 'sp-icon sp-shop-1',
    link: '/seller/store',
  },
];
