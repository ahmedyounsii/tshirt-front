import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export type AppView = 'admin' | 'user';

const ADMIN_ROOT = '/admin';

const isAdminUrl = (url: string) =>
  url === ADMIN_ROOT || url.startsWith(`${ADMIN_ROOT}/`) || url.startsWith(`${ADMIN_ROOT}?`);

// Admins see the app in two ways, picked from the header: the shop as customers see
// it (user view), or the back office with its sidebar (admin view, the /admin pages).
// The view follows the URL, so a link or a reload always lands in the right one, and
// each view reopens on the last page visited in it
@Injectable({
  providedIn: 'root',
})
export class AdminViewService {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly view = computed<AppView>(() =>
    this.auth.isAdmin() && isAdminUrl(this.url()) ? 'admin' : 'user',
  );
  readonly isAdminView = computed(() => this.view() === 'admin');

  // Sidebar of the admin view on small screens, where it slides over the page
  readonly sidebarOpen = signal(false);

  private lastUrls: Record<AppView, string> = { admin: ADMIN_ROOT, user: '/' };

  constructor() {
    effect(
      () => {
        const url = this.url();
        this.lastUrls[isAdminUrl(url) ? 'admin' : 'user'] = url;
        this.sidebarOpen.set(false);
      },
      { allowSignalWrites: true },
    );
  }

  switchTo(view: AppView) {
    if (view !== this.view()) this.router.navigateByUrl(this.lastUrls[view]);
  }
}
