import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './services/auth/auth.guards';

// Pages are lazy loaded: each one (and its heavy libs) is only downloaded when visited
const loadDesignManage = () =>
  import('./pages/design-manage/design-manage.component').then(
    (m) => m.DesignManageComponent,
  );
const loadDesigner = () =>
  import('./pages/tshirt-designer/tshirt-designer.component').then(
    (m) => m.TshirtDesignerComponent,
  );

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  // All tshirts, paginated ("See more" of the home carousel)
  {
    path: 'tshirt_gallery',
    loadComponent: () =>
      import('./pages/tshirt-gallery/tshirt-gallery.component').then(
        (m) => m.TshirtGalleryComponent,
      ),
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
    path: 'saved-tshirts',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/saved-tshirts/saved-tshirts.component').then(
        (m) => m.SavedTshirtsComponent,
      ),
  },
  // Tshirts saved by the logged in user
  {
    path: 'my_design',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-designs/my-designs.component').then(
        (m) => m.MyDesignsComponent,
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
