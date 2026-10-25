import { afterNextRender, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
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

  loader = inject(LoaderService);

  constructor() {
    inject(SeoService).init();
    // Startup mask: the server renders it and the browser hides it 1s after the first render
    afterNextRender(() => setTimeout(() => this.loader.hide(), 1000));
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
