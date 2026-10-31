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
    icon: 'pi pi-palette',
    link: '/my_store',
  },
  {
    id: 'favorites',
    label: 'common.myFavorites',
    icon: 'pi pi-heart',
    link: '/favorites',
  },
  {
    id: 'orders',
    label: 'common.myOrders',
    icon: 'pi pi-box',
    link: '/orders',
  },
  // Until seller access is active; sellers reach their dashboard from the header button
  // (app-header-seller), where their promotions are too
  {
    id: 'becomeSeller',
    label: 'seller.links.becomeSeller',
    icon: 'pi pi-briefcase',
    link: '/become-seller',
  },
];

// Admins only, their own pages under /admin (the sidebar of the admin view)
export const ADMIN_LINKS: AccountLink[] = [
  {
    id: 'dashboard',
    label: 'adminView.dashboard',
    icon: 'pi pi-chart-bar',
    link: '/admin',
  },
  {
    id: 'designs',
    label: 'common.manageDesigns',
    icon: 'pi pi-images',
    link: '/admin/designs',
  },
  {
    id: 'designCategories',
    label: 'common.categories',
    icon: 'pi pi-folder',
    link: '/admin/designs/categories',
    parent: 'designs',
  },
  {
    id: 'designList',
    label: 'common.designs',
    icon: 'pi pi-image',
    link: '/admin/designs',
    parent: 'designs',
  },
  {
    id: 'templates',
    label: 'admin.templates.title',
    icon: 'pi pi-box',
    link: '/admin/designs/templates',
    parent: 'designs',
  },
  {
    id: 'savedProducts',
    label: 'common.savedProducts',
    icon: 'pi pi-bookmark',
    link: '/admin/saved-products',
  },
  {
    id: 'collections',
    label: 'common.manageCollections',
    icon: 'pi pi-th-large',
    link: '/admin/collections',
  },
  {
    id: 'manageOrders',
    label: 'common.manageOrders',
    icon: 'pi pi-inbox',
    link: '/admin/orders',
  },
  {
    id: 'discounts',
    label: 'common.manageDiscounts',
    icon: 'pi pi-percentage',
    link: '/admin/discounts',
  },
  {
    id: 'pricing',
    label: 'common.pricing',
    icon: 'pi pi-tag',
    link: '/admin/pricing',
  },
  {
    id: 'delivery',
    label: 'common.delivery',
    icon: 'pi pi-truck',
    link: '/admin/delivery',
  },
  // Marketplace
  {
    id: 'sellerApplications',
    label: 'seller.links.applications',
    icon: 'pi pi-id-card',
    link: '/admin/seller-applications',
  },
  {
    id: 'sellers',
    label: 'seller.links.sellers',
    icon: 'pi pi-users',
    link: '/admin/sellers',
  },
  {
    id: 'commission',
    label: 'seller.links.commission',
    icon: 'pi pi-percentage',
    link: '/admin/commission',
  },
  {
    id: 'revenue',
    label: 'seller.links.revenue',
    icon: 'pi pi-wallet',
    link: '/admin/revenue',
  },
  {
    id: 'audit',
    label: 'seller.links.audit',
    icon: 'pi pi-history',
    link: '/admin/audit',
  },
  // Super admin only
  {
    id: 'admins',
    label: 'adminView.admins',
    icon: 'pi pi-shield',
    link: '/admin/admins',
  },
];

// Seller dashboard pages under /seller (its sidebar)
export const SELLER_LINKS: AccountLink[] = [
  {
    id: 'sellerOverview',
    label: 'seller.links.overview',
    icon: 'pi pi-chart-bar',
    link: '/seller',
  },
  {
    id: 'sellerDesigns',
    label: 'seller.links.designs',
    icon: 'pi pi-images',
    link: '/seller/designs',
  },
  {
    id: 'sellerProducts',
    label: 'seller.links.products',
    icon: 'pi pi-tags',
    link: '/seller/products',
  },
  {
    id: 'sellerCollections',
    label: 'seller.links.collections',
    icon: 'pi pi-th-large',
    link: '/seller/collections',
  },
  {
    id: 'sellerPromotions',
    label: 'seller.links.promotions',
    icon: 'pi pi-percentage',
    link: '/seller/promotions',
  },
  {
    id: 'sellerOrders',
    label: 'seller.links.orders',
    icon: 'pi pi-inbox',
    link: '/seller/orders',
  },
  {
    id: 'sellerEarnings',
    label: 'seller.links.earnings',
    icon: 'pi pi-wallet',
    link: '/seller/earnings',
  },
  {
    id: 'sellerStore',
    label: 'seller.links.store',
    icon: 'pi pi-shop',
    link: '/seller/store',
  },
];
