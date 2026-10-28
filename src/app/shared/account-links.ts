// Pages of the account, listed in the account menu of the header
export type AccountLinkId =
  | 'products'
  | 'favorites'
  | 'myCollections'
  | 'myDiscounts'
  | 'orders'
  | 'designs'
  | 'savedProducts'
  | 'collections'
  | 'manageOrders'
  | 'discounts'
  | 'pricing';

export interface AccountLink {
  id: AccountLinkId;
  label: string;
  icon: string;
  link: string;
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
    id: 'myCollections',
    label: 'common.myCollections',
    icon: 'pi pi-th-large',
    link: '/my-collections',
  },
  {
    id: 'myDiscounts',
    label: 'common.myDiscounts',
    icon: 'pi pi-percentage',
    link: '/my-discounts',
  },
  {
    id: 'orders',
    label: 'common.myOrders',
    icon: 'pi pi-box',
    link: '/orders',
  },
];

// Admins only, their own pages under /admin
export const ADMIN_LINKS: AccountLink[] = [
  {
    id: 'designs',
    label: 'common.manageDesigns',
    icon: 'pi pi-images',
    link: '/admin/designs',
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
];
