import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { creatorLink } from '../../models/user.model';
import { AuthService } from './auth.service';
import { StoresService } from '../stores/stores.service';

// The session lives in localStorage, which the server render can't read: guards
// run for real once the browser takes over. Protected pages are never rendered
// on the server, otherwise their content would flash before the redirect
const onServer = () => !isPlatformBrowser(inject(PLATFORM_ID));

// Pages for logged in users: others are sent to the login page, then back here
export const authGuard: CanActivateFn = (route, state) => {
  if (onServer()) return false;
  if (inject(AuthService).isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/auth'], {
    queryParams: { returnUrl: state.url },
  });
};

// Pages for admins only
export const adminGuard: CanActivateFn = (route, state) => {
  if (onServer()) return false;
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth'], {
      queryParams: { returnUrl: state.url },
    });
  }
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};

// The seller dashboard: activated sellers only, others land on the seller application page
// (admins, who can't sell, on their dashboard)
export const sellerGuard: CanActivateFn = (route, state) => {
  if (onServer()) return false;
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth'], {
      queryParams: { returnUrl: state.url },
    });
  }
  if (auth.isSeller()) return true;
  return router.createUrlTree([auth.isAdmin() ? '/admin' : '/become-seller']);
};

// The seller application: logged in users who aren't admins (admins can't sell)
export const sellerApplicantGuard: CanActivateFn = (route, state) => {
  if (onServer()) return false;
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth'], {
      queryParams: { returnUrl: state.url },
    });
  }
  return auth.isAdmin() ? router.createUrlTree(['/admin']) : true;
};

// Pages for the super admin only (naming the admins): other admins go back to the dashboard
export const superAdminGuard: CanActivateFn = () => {
  if (onServer()) return false;
  const auth = inject(AuthService);
  return auth.isSuperAdmin() ? true : inject(Router).createUrlTree(['/admin']);
};

// The login page: already logged in users have nothing to do there
export const guestGuard: CanActivateFn = () => {
  if (onServer()) return true;
  return inject(AuthService).isLoggedIn()
    ? inject(Router).createUrlTree(['/'])
    : true;
};

// /store/<username> of the logged in user: their own store page instead of the public one
// (by id too, for accounts made before usernames, and by their store's address once known;
// unknown yet, the public page finds it is theirs and sends them here)
export const ownStoreMatch: CanMatchFn = (route, segments) => {
  if (onServer()) return false;
  const user = inject(AuthService).user();
  const handle = segments[1]?.path.toLowerCase();
  if (!user || !handle) return false;
  const slug = inject(StoresService).mySlug(user._id);
  return [user.username?.toLowerCase(), user._id, slug].includes(handle);
};

// /my_store: the logged in user's store, at /store/<username>
export const myStoreRedirect: CanActivateFn = () => {
  const user = inject(AuthService).user();
  return inject(Router).createUrlTree(user ? creatorLink(user) : ['/']);
};
