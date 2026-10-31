import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  guestGuard,
  myStoreRedirect,
  ownStoreMatch,
  sellerGuard,
  sellerApplicantGuard,
  superAdminGuard,
} from './services/auth/auth.guards';
import { maintenanceGuard } from './services/maintenance/maintenance.guard';
import { OPEN_DURING_MAINTENANCE } from './services/maintenance/maintenance.service';
import { SeoRouteData } from './shared/seo.config';

// Meta tags of each page (see SeoService)
const indexed = (seo: SeoRouteData['seo']): { data: SeoRouteData } => ({ data: { seo } });
const notIndexed = (seo: SeoRouteData['seo']): { data: SeoRouteData } => ({
  data: { seo, noindex: true },
});

// Pages are lazy loaded: each one (and its heavy libs) is only downloaded when visited
// Collections: the admin manages every one, users their own (/my-collections)
const loadManageCollections = () =>
  import('./pages/manage-collections/manage-collections.component').then(
    (m) => m.ManageCollectionsComponent,
  );
const loadCollectionEditor = () =>
  import('./pages/collection-editor/collection-editor.component').then(
    (m) => m.CollectionEditorComponent,
  );
const leaveCollectionEditor = (
  component: import('./pages/collection-editor/collection-editor.component').CollectionEditorComponent,
) => component.confirmLeave();
// Discounts: the admin manages every one, users their own on their products (/my-discounts)
const loadManageDiscounts = () =>
  import('./pages/manage-discounts/manage-discounts.component').then(
    (m) => m.ManageDiscountsComponent,
  );
const loadDiscountEditor = () =>
  import('./pages/discount-editor/discount-editor.component').then(
    (m) => m.DiscountEditorComponent,
  );
const leaveDiscountEditor = (
  component: import('./pages/discount-editor/discount-editor.component').DiscountEditorComponent,
) => component.confirmLeave();
const loadShareDesign = () =>
  import('./pages/share-design/share-design.component').then((m) => m.ShareDesignComponent);
const loadPanelLayout = () =>
  import('./pages/admin/admin-layout/admin-layout.component').then(
    (m) => m.AdminLayoutComponent,
  );
const loadDesigner = () =>
  import('./pages/product-designer/product-designer.component').then(
    (m) => m.ProductDesignerComponent,
  );

const pages: Routes = [
  {
    path: '',
    ...indexed('home'),
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  // All products, paginated ("See more" of the home carousel)
  {
    path: 'stores',
    ...indexed('store'),
    loadComponent: () =>
      import('./pages/store/store.component').then(
        (m) => m.StoreComponent,
      ),
  },
  // The shop's former address: old links and search results land on /stores (query kept);
  // /store/<username> is still a creator's store
  { path: 'store', pathMatch: 'full', redirectTo: 'stores' },
  // Every collection, one showcase each, linking to their landing pages
  {
    path: 'collections',
    ...indexed('allCollections'),
    loadComponent: () =>
      import('./pages/collections/collections.component').then((m) => m.CollectionsComponent),
  },
  // Landing page of each collection made in the admin (/collection/t-shirt-marvel...).
  // Its meta tags are set once the collection is loaded (see SeoService.setPage)
  {
    path: 'collection/:slug',
    ...indexed('collection'),
    loadComponent: () =>
      import('./pages/collection/collection.component').then((m) => m.CollectionComponent),
  },
  // All designs, filtered and paginated ("See all designs" of the home showcase)
  {
    path: 'designs',
    ...indexed('designs'),
    loadComponent: () =>
      import('./pages/designs/designs.component').then((m) => m.DesignsComponent),
  },
  // Page of one product (/product/<id>): pictures, sizes, details, similar products.
  // Its meta tags are set once the product is loaded (see SeoService.setPage)
  {
    path: 'product/:id',
    ...indexed('product'),
    loadComponent: () =>
      import('./pages/product/product.component').then((m) => m.ProductComponent),
  },
  { path: 'designer', ...indexed('designer'), loadComponent: loadDesigner },
  // Admin only pages, in the admin view: sidebar on the left, dashboard as home
  {
    path: 'admin',
    canActivate: [adminGuard],
    data: { panel: 'admin' },
    loadComponent: loadPanelLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        ...notIndexed('admin'),
        loadComponent: () =>
          import('./pages/admin/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      // Designs, their categories and the templates: one page each, under "Manage designs"
      // in the sidebar
      {
        path: 'designs',
        children: [
          {
            path: '',
            ...notIndexed('admin'),
            loadComponent: () =>
              import('./pages/admin/admin-designs/admin-designs.component').then(
                (m) => m.AdminDesignsComponent,
              ),
          },
          {
            path: 'categories',
            ...notIndexed('admin'),
            loadComponent: () =>
              import(
                './pages/admin/admin-design-categories/admin-design-categories.component'
              ).then((m) => m.AdminDesignCategoriesComponent),
          },
          {
            path: 'templates',
            ...notIndexed('admin'),
            loadComponent: () =>
              import('./pages/admin/admin-templates/admin-templates.component').then(
                (m) => m.AdminTemplatesComponent,
              ),
          },
          // Old tab of the page
          { path: 'designs', redirectTo: '' },
        ],
      },
      {
        path: 'saved-products',
        ...notIndexed('admin'),
        loadComponent: () =>
          import('./pages/saved-products/saved-products.component').then(
            (m) => m.SavedProductsComponent,
          ),
      },
      // Collections: list, then the editor of one ("new" to create one)
      {
        path: 'collections',
        ...notIndexed('admin'),
        loadComponent: loadManageCollections,
      },
      {
        path: 'collections/:id',
        ...notIndexed('admin'),
        canDeactivate: [leaveCollectionEditor],
        loadComponent: loadCollectionEditor,
      },
      // Every order: status changes and deletes
      {
        path: 'orders',
        ...notIndexed('admin'),
        loadComponent: () =>
          import('./pages/manage-orders/manage-orders.component').then(
            (m) => m.ManageOrdersComponent,
          ),
      },
      // Discounts: list, then the editor of one ("new" to create one)
      {
        path: 'discounts',
        ...notIndexed('admin'),
        loadComponent: loadManageDiscounts,
      },
      {
        path: 'discounts/:id',
        ...notIndexed('admin'),
        canDeactivate: [leaveDiscountEditor],
        loadComponent: loadDiscountEditor,
      },
      // Price list every product is priced from: per style, per design and per text
      {
        path: 'pricing',
        ...notIndexed('admin'),
        canDeactivate: [
          (component: import('./pages/pricing/pricing.component').PricingComponent) =>
            component.confirmLeave(),
        ],
        loadComponent: () =>
          import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
      },
      // Delivery options offered at checkout: delay, price, free from an amount
      {
        path: 'delivery',
        ...notIndexed('admin'),
        canDeactivate: [
          (
            component: import('./pages/delivery-settings/delivery-settings.component').DeliverySettingsComponent,
          ) => component.confirmLeave(),
        ],
        loadComponent: () =>
          import('./pages/delivery-settings/delivery-settings.component').then(
            (m) => m.DeliverySettingsComponent,
          ),
      },
      // Marketplace: seller applications and their activation codes, sellers with their
      // commission rates and payouts, and the platform's revenue from them
      {
        path: 'seller-applications',
        ...notIndexed('admin'),
        loadComponent: () =>
          import('./pages/admin/admin-seller-applications/admin-seller-applications.component').then(
            (m) => m.AdminSellerApplicationsComponent,
          ),
      },
      {
        path: 'sellers',
        ...notIndexed('admin'),
        loadComponent: () =>
          import('./pages/admin/admin-sellers/admin-sellers.component').then(
            (m) => m.AdminSellersComponent,
          ),
      },
      {
        path: 'revenue',
        ...notIndexed('admin'),
        loadComponent: () =>
          import('./pages/admin/admin-revenue/admin-revenue.component').then(
            (m) => m.AdminRevenueComponent,
          ),
      },
      // Super admin only: names the admins (and removes them)
      {
        path: 'admins',
        ...notIndexed('admin'),
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/admin/admin-admins/admin-admins.component').then(
            (m) => m.AdminAdminsComponent,
          ),
      },
      // Production sheet of one order, laid out for printing (the sidebar isn't printed)
      {
        path: 'orders/:id/print',
        ...notIndexed('admin'),
        loadComponent: () =>
          import('./pages/order-print/order-print.component').then(
            (m) => m.OrderPrintComponent,
          ),
      },
    ],
  },
  // Store of the logged in user (/store/<their username>): identity, totals and the
  // products they saved
  {
    path: 'store/:handle',
    data: { ...notIndexed('account').data, routeClass: 'route-my-store' },
    canMatch: [ownStoreMatch],
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  // Public store of a creator (/store/<username>): the products they saved,
  // opened from their name on a product card
  {
    path: 'store/:handle',
    ...indexed('creator'),
    loadComponent: () =>
      import('./pages/creator/creator.component').then((m) => m.CreatorComponent),
  },
  // Shortcut to the logged in user's store
  {
    path: 'my_store',
    canActivate: [authGuard, myStoreRedirect],
    children: [],
  },
  // Account settings of the logged in user: name, username, email and password
  {
    path: 'settings',
    ...notIndexed('account'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
  // Designs shared by the logged in user, public in the designs gallery ("new" to share one)
  {
    path: 'my-designs',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        ...notIndexed('account'),
        loadComponent: () =>
          import('./pages/my-designs/my-designs.component').then((m) => m.MyDesignsComponent),
      },
      {
        path: 'new',
        ...notIndexed('account'),
        loadComponent: loadShareDesign,
      },
    ],
  },
  // Products hearted by the logged in user
  {
    path: 'favorites',
    ...notIndexed('account'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/favorites/favorites.component').then((m) => m.FavoritesComponent),
  },
  // Collections made by the logged in user, same pages as the admin's ("new" to create one)
  {
    path: 'my-collections',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        data: { ...notIndexed('account').data, mine: true },
        loadComponent: loadManageCollections,
      },
      {
        path: ':id',
        data: { ...notIndexed('account').data, mine: true },
        canDeactivate: [leaveCollectionEditor],
        loadComponent: loadCollectionEditor,
      },
    ],
  },
  // Discounts made by the logged in user on their own products, same pages as the admin's
  // without the home page card ("new" to create one)
  {
    path: 'my-discounts',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        data: { ...notIndexed('account').data, mine: true },
        loadComponent: loadManageDiscounts,
      },
      {
        path: ':id',
        data: { ...notIndexed('account').data, mine: true },
        canDeactivate: [leaveDiscountEditor],
        loadComponent: loadDiscountEditor,
      },
    ],
  },
  // Seller application of the logged in user: the form, where it stands, then the activation
  // code once approved
  {
    path: 'become-seller',
    ...notIndexed('account'),
    canActivate: [sellerApplicantGuard],
    loadComponent: () =>
      import('./pages/become-seller/become-seller.component').then(
        (m) => m.BecomeSellerComponent,
      ),
  },
  // Seller dashboard, in the same frame as the admin view: the seller's own catalog, orders
  // and earnings. Collections, promotions and design sharing reuse the account pages
  {
    path: 'seller',
    canActivate: [sellerGuard],
    data: { panel: 'seller' },
    loadComponent: loadPanelLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        ...notIndexed('seller'),
        loadComponent: () =>
          import('./pages/seller/seller-overview/seller-overview.component').then(
            (m) => m.SellerOverviewComponent,
          ),
      },
      {
        path: 'designs',
        ...notIndexed('seller'),
        loadComponent: () =>
          import('./pages/seller/seller-designs/seller-designs.component').then(
            (m) => m.SellerDesignsComponent,
          ),
      },
      {
        path: 'designs/new',
        data: { ...notIndexed('seller').data, returnUrl: '/seller/designs' },
        loadComponent: loadShareDesign,
      },
      {
        path: 'products',
        ...notIndexed('seller'),
        loadComponent: () =>
          import('./pages/seller/seller-products/seller-products.component').then(
            (m) => m.SellerProductsComponent,
          ),
      },
      {
        path: 'collections',
        data: { ...notIndexed('seller').data, mine: true, base: '/seller/collections' },
        loadComponent: loadManageCollections,
      },
      {
        path: 'collections/:id',
        data: { ...notIndexed('seller').data, mine: true, base: '/seller/collections' },
        canDeactivate: [leaveCollectionEditor],
        loadComponent: loadCollectionEditor,
      },
      {
        path: 'promotions',
        data: { ...notIndexed('seller').data, mine: true, base: '/seller/promotions' },
        loadComponent: loadManageDiscounts,
      },
      {
        path: 'promotions/:id',
        data: { ...notIndexed('seller').data, mine: true, base: '/seller/promotions' },
        canDeactivate: [leaveDiscountEditor],
        loadComponent: loadDiscountEditor,
      },
      {
        path: 'orders',
        ...notIndexed('seller'),
        loadComponent: () =>
          import('./pages/seller/seller-orders/seller-orders.component').then(
            (m) => m.SellerOrdersComponent,
          ),
      },
      {
        path: 'earnings',
        ...notIndexed('seller'),
        loadComponent: () =>
          import('./pages/seller/seller-earnings/seller-earnings.component').then(
            (m) => m.SellerEarningsComponent,
          ),
      },
      {
        path: 'store',
        ...notIndexed('seller'),
        loadComponent: () =>
          import('./pages/seller/seller-store/seller-store.component').then(
            (m) => m.SellerStoreComponent,
          ),
      },
    ],
  },
  // Orders placed by the logged in user (admins included)
  {
    path: 'orders',
    ...notIndexed('account'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-orders/my-orders.component').then(
        (m) => m.MyOrdersComponent,
      ),
  },
  // Old links keep working
  { path: 'creator/:handle', redirectTo: 'store/:handle' },
  { path: 'profile', redirectTo: 'my_store' },
  { path: 'my_product', redirectTo: 'my_store' },
  { path: 'my_order', redirectTo: 'orders' },
  { path: 'design_manage/:id', redirectTo: 'admin/designs/:id' },
  { path: 'design_manage', redirectTo: 'admin/designs' },
  { path: 'article/:id', redirectTo: 'admin/designs/:id' },
  { path: 'article', redirectTo: 'admin/designs' },
  { path: 'saved-products', redirectTo: 'admin/saved-products' },
  { path: 'manage_collections/:id', redirectTo: 'admin/collections/:id' },
  { path: 'manage_collections', redirectTo: 'admin/collections' },
  { path: 'manage_orders/:id/print', redirectTo: 'admin/orders/:id/print' },
  { path: 'manage_orders', redirectTo: 'admin/orders' },
  { path: 'pricing', redirectTo: 'admin/pricing' },
  { path: 'manage-discount/:id', redirectTo: 'admin/discounts/:id' },
  { path: 'manage-discount', redirectTo: 'admin/discounts' },
  // Cart review, shipping, delivery & payment, then the order (needs an account:
  // a guest cart is merged into the user's once logged in)
  {
    path: 'checkout',
    ...notIndexed('checkout'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/checkout/checkout.component').then(
        (m) => m.CheckoutComponent,
      ),
  },
  // Shown while the shop is down: full screen, without the header
  {
    path: 'maintenance',
    ...notIndexed('maintenance'),
    loadComponent: () =>
      import('./pages/maintenance/maintenance.component').then(
        (m) => m.MaintenanceComponent,
      ),
  },
  // Login and registration
  {
    path: 'auth',
    ...notIndexed('auth'),
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/auth.component').then((m) => m.AuthComponent),
  },
  // Unknown URLs (the server answers them with a 404) land on the home page
  { path: '**', redirectTo: '' },
];

// Every other page sends visitors to the maintenance page while the shop is down
export const routes: Routes = pages.map((route) =>
  route.redirectTo != null || OPEN_DURING_MAINTENANCE.includes(route.path ?? '')
    ? route
    : { ...route, canActivate: [maintenanceGuard, ...(route.canActivate ?? [])] },
);
