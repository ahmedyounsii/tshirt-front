import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './services/auth/auth.guards';
import { SeoRouteData } from './shared/seo.config';

// Meta tags of each page (see SeoService)
const indexed = (seo: SeoRouteData['seo']): { data: SeoRouteData } => ({ data: { seo } });
const notIndexed = (seo: SeoRouteData['seo']): { data: SeoRouteData } => ({
  data: { seo, noindex: true },
});

// Pages are lazy loaded: each one (and its heavy libs) is only downloaded when visited
const loadDesignManage = () =>
  import('./pages/design-manage/design-manage.component').then(
    (m) => m.DesignManageComponent,
  );
const loadDesigner = () =>
  import('./pages/product-designer/product-designer.component').then(
    (m) => m.ProductDesignerComponent,
  );

export const routes: Routes = [
  {
    path: '',
    ...indexed('home'),
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  // All products, paginated ("See more" of the home carousel)
  {
    path: 'store',
    ...indexed('store'),
    loadComponent: () =>
      import('./pages/store/store.component').then(
        (m) => m.StoreComponent,
      ),
  },
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
  // Admin only pages
  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'designs' },
      {
        path: 'designs/:id',
        ...notIndexed('admin'),
        loadComponent: loadDesignManage,
      },
      {
        path: 'designs',
        ...notIndexed('admin'),
        loadComponent: loadDesignManage,
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
        loadComponent: () =>
          import('./pages/manage-collections/manage-collections.component').then(
            (m) => m.ManageCollectionsComponent,
          ),
      },
      {
        path: 'collections/:id',
        ...notIndexed('admin'),
        canDeactivate: [
          (
            component: import('./pages/collection-editor/collection-editor.component').CollectionEditorComponent,
          ) => component.confirmLeave(),
        ],
        loadComponent: () =>
          import('./pages/collection-editor/collection-editor.component').then(
            (m) => m.CollectionEditorComponent,
          ),
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
    ],
  },
  // Production sheet of one order, laid out for printing
  {
    path: 'admin/orders/:id/print',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/order-print/order-print.component').then(
        (m) => m.OrderPrintComponent,
      ),
  },
  // Public profile of a creator (/creator/<username>): the products they saved,
  // opened from their name on a product card
  {
    path: 'creator/:handle',
    ...indexed('creator'),
    loadComponent: () =>
      import('./pages/creator/creator.component').then((m) => m.CreatorComponent),
  },
  // Profile of the logged in user: identity, totals and the products they saved
  {
    path: 'profile',
    ...notIndexed('account'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
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
  { path: 'my_product', redirectTo: 'profile' },
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
  // Login and registration
  {
    path: 'auth',
    ...notIndexed('auth'),
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/auth.component').then((m) => m.AuthComponent),
  },
];
