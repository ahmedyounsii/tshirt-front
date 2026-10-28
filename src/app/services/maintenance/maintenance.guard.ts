import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { MaintenanceService } from './maintenance.service';

// Every page but the maintenance page and the login: while the shop is in maintenance,
// visitors land on the maintenance page and admins keep using the site.
// The server prerenders pages as usual, the browser checks once it takes over
export const maintenanceGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  if (inject(AuthService).isAdmin()) return true;
  const router = inject(Router);
  return inject(MaintenanceService)
    .load()
    .pipe(
      map(({ enabled }) =>
        enabled ? router.createUrlTree(['/maintenance']) : true,
      ),
    );
};
