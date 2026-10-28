import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Event,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { FreeShippingHeaderComponent } from './components/free-shipping-header/free-shipping-header.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ShopNowDialogComponent } from './components/shop-now-dialog/shop-now-dialog.component';
import { ImgPreviewerComponent } from './components/img-previewer/img-previewer.component';
import { LoaderMaskComponent } from './components/loader-mask/loader-mask.component';
import { RouteProgressComponent } from './components/route-progress/route-progress.component';
import { PreviewService } from './services/preview/preview.service';
import { LoaderService } from './services/loader/loader.service';
import { SeoService } from './services/seo.service';
import { AnalyticsService } from './services/analytics.service';

// A navigation that shows a page, or fails for good. A redirect (maintenance, login...)
// cancels it but starts the next one, which settles in turn
const isSettled = (e: Event) =>
  e instanceof NavigationEnd ||
  e instanceof NavigationError ||
  (e instanceof NavigationCancel &&
    e.code === NavigationCancellationCode.GuardRejected);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FreeShippingHeaderComponent,
    ConfirmDialogComponent,
    ShopNowDialogComponent,
    ImgPreviewerComponent,
    LoaderMaskComponent,
    RouteProgressComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  previewer = inject(PreviewService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Class of the current page on .main-layout (route-home, route-designer, route-profile-admin-orders-print...)
  routeClass = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.currentRouteClass()),
    ),
    { initialValue: '' },
  );

  standalonePage = computed(() =>
    ['route-maintenance', 'route-auth'].includes(this.routeClass()),
  );

  loader = inject(LoaderService);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Startup: the browser shows the mask alone, no component at all, until the first
  // page is settled, the maintenance check included (it may send visitors to the
  // maintenance page). The server never boots: its prerendered page keeps the content
  // for search engines, under the mask
  readonly booting = signal(true);

  constructor() {
    inject(SeoService).init();
    inject(AnalyticsService).init();
    if (this.isBrowser) {
      firstValueFrom(this.router.events.pipe(filter(isSettled))).then(() =>
        this.booting.set(false),
      );
    }
  }

  // Path of the active route, its parents included, without its params:
  // 'profile/admin/orders/:id/print' -> 'profile-admin-orders-print'
  private currentRouteClass() {
    const segments: string[] = [];
    let route: ActivatedRoute | null = this.route;
    while (route) {
      segments.push(...(route.routeConfig?.path ?? '').split('/'));
      route = route.firstChild;
    }
    const path = segments
      .filter((segment) => segment && !segment.startsWith(':'))
      .join('-');
    return `route-${path || 'home'}`;
  }
}
