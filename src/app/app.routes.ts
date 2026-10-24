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
  // Admin only pages
  {
    path: 'design_manage/:id',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    loadComponent: loadDesignManage,
  },
  {
    path: 'design_manage',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    loadComponent: loadDesignManage,
  },
  // Old links keep working
  { path: 'article/:id', redirectTo: 'design_manage/:id' },
  { path: 'article', redirectTo: 'design_manage' },
  { path: 'designer', ...indexed('designer'), loadComponent: loadDesigner },
  {
    path: 'saved-products',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/saved-products/saved-products.component').then(
        (m) => m.SavedProductsComponent,
      ),
  },
  // Collections: list, then the editor of one ("new" to create one)
  {
    path: 'manage_collections',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/manage-collections/manage-collections.component').then(
        (m) => m.ManageCollectionsComponent,
      ),
  },
  {
    path: 'manage_collections/:id',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
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
    path: 'manage_orders',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/manage-orders/manage-orders.component').then(
        (m) => m.ManageOrdersComponent,
      ),
  },
  // Price list every product is priced from: per style, per design and per text
  {
    path: 'pricing',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    canDeactivate: [
      (component: import('./pages/pricing/pricing.component').PricingComponent) =>
        component.confirmLeave(),
    ],
    loadComponent: () =>
      import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
  },
  // Production sheet of one order, laid out for printing
  {
    path: 'manage_orders/:id/print',
    ...notIndexed('admin'),
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/order-print/order-print.component').then(
        (m) => m.OrderPrintComponent,
      ),
  },
  // Products saved by the logged in user
  {
    path: 'my_product',
    ...notIndexed('account'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-designs/my-designs.component').then(
        (m) => m.MyDesignsComponent,
      ),
  },
  // Orders placed by the logged in user
  {
    path: 'my_order',
    ...notIndexed('account'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-orders/my-orders.component').then(
        (m) => m.MyOrdersComponent,
      ),
  },
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
