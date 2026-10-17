import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './services/auth/auth.guards';

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
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  // All products, paginated ("See more" of the home carousel)
  {
    path: 'store',
    loadComponent: () =>
      import('./pages/store/store.component').then(
        (m) => m.StoreComponent,
      ),
  },
  // All designs, filtered and paginated ("See all designs" of the home showcase)
  {
    path: 'designs',
    loadComponent: () =>
      import('./pages/designs/designs.component').then((m) => m.DesignsComponent),
  },
  // Admin only pages
  {
    path: 'design_manage/:id',
    canActivate: [adminGuard],
    loadComponent: loadDesignManage,
  },
  { path: 'design_manage', canActivate: [adminGuard], loadComponent: loadDesignManage },
  // Old links keep working
  { path: 'article/:id', redirectTo: 'design_manage/:id' },
  { path: 'article', redirectTo: 'design_manage' },
  { path: 'designer', loadComponent: loadDesigner },
  {
    path: 'saved-products',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/saved-products/saved-products.component').then(
        (m) => m.SavedProductsComponent,
      ),
  },
  // Every order: status changes and deletes
  {
    path: 'manage_orders',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/manage-orders/manage-orders.component').then(
        (m) => m.ManageOrdersComponent,
      ),
  },
  // Price list every product is priced from: per style, per design and per text
  {
    path: 'pricing',
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
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/order-print/order-print.component').then(
        (m) => m.OrderPrintComponent,
      ),
  },
  // Products saved by the logged in user
  {
    path: 'my_product',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-designs/my-designs.component').then(
        (m) => m.MyDesignsComponent,
      ),
  },
  // Orders placed by the logged in user
  {
    path: 'my_order',
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/checkout/checkout.component').then(
        (m) => m.CheckoutComponent,
      ),
  },
  // Login and registration
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/auth.component').then((m) => m.AuthComponent),
  },
];
