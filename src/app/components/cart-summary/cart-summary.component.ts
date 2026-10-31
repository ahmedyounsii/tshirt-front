import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PricePipe } from '../../shared/price.pipe';
import { Router } from '@angular/router';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { TranslatePipe } from '@ngx-translate/core';
import { CartService } from '../../services/cart/cart.service';
import { PreviewService } from '../../services/preview/preview.service';
import { AuthService } from '../../services/auth/auth.service';
import { cartItemKey } from '../../models/cart.model';
import { DeliveryService } from '../../services/delivery/delivery.service';
import { CartLineComponent } from '../cart-line/cart-line.component';
import { EmptyComponent } from '../empty/empty.component';
import {
  BottomDrawerComponent,
  injectIsMobile,
} from '../bottom-drawer/bottom-drawer.component';
import { DrawerComponent } from '../drawer/drawer.component';
import { TagComponent } from '../tag/tag.component';

// Bag button of the header and the cart drawer it opens (also opened after "Shop now")
// The drawer is a bottom sheet on mobile, a side drawer on desktop
// The cart lives in localStorage or behind the session: rendered by the browser only
@Component({
    selector: 'app-cart-summary',
    imports: [
        TagComponent,
        PricePipe,
        NgTemplateOutlet,
        TranslatePipe,
        BottomDrawerComponent,
        DrawerComponent,
        SkeletonComponent,
        CartLineComponent,
        EmptyComponent,
    ],
    host: { ngSkipHydration: 'true' },
    templateUrl: './cart-summary.component.html',
    styleUrl: './cart-summary.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartSummaryComponent {
  cart = inject(CartService);
  previewer = inject(PreviewService);
  auth = inject(AuthService);
  private router = inject(Router);

  readonly isMobile = injectIsMobile();
  private sheet = viewChild(BottomDrawerComponent);
  private drawer = viewChild(DrawerComponent);

  // Lowest amount some delivery option is free from, null when none is
  readonly freeShippingFrom = inject(DeliveryService).freeShippingFrom;
  readonly key = cartItemKey;

  // Newest lines first
  items = computed(() => [...this.cart.items()].reverse());
  missingForFreeShipping = computed(() =>
    Math.max(0, Math.round(((this.freeShippingFrom() ?? 0) - this.cart.subtotal()) * 100) / 100),
  );
  freeShippingProgress = computed(() => {
    const from = this.freeShippingFrom();
    return from ? Math.min(100, (this.cart.subtotal() / from) * 100) : 100;
  });

  // Both drawers slide out before they unmount
  close() {
    const drawer = this.sheet() ?? this.drawer();
    if (drawer) drawer.close();
    else this.cart.drawerOpen.set(false);
  }

  checkout() {
    this.close();
    this.router.navigate(['/checkout']);
  }

  browse() {
    this.close();
    this.router.navigate(['/stores']);
  }
}
