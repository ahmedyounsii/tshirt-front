import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe } from '@ngx-translate/core';
import { CartService } from '../../services/cart/cart.service';
import { PreviewService } from '../../services/preview/preview.service';
import { AuthService } from '../../services/auth/auth.service';
import { cartItemKey } from '../../models/cart.model';
import { FREE_SHIPPING_FROM } from '../../shared/checkout.config';
import { CartLineComponent } from '../cart-line/cart-line.component';

// Bag button of the header and the cart drawer it opens (also opened after "Shop now")
// The cart lives in localStorage or behind the session: rendered by the browser only
@Component({
  selector: 'app-cart-summary',
  standalone: true,
  imports: [
    CurrencyPipe,
    TranslatePipe,
    ButtonModule,
    DrawerModule,
    SkeletonModule,
    CartLineComponent,
  ],
  host: { ngSkipHydration: 'true' },
  templateUrl: './cart-summary.component.html',
  styleUrl: './cart-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartSummaryComponent {
  cart = inject(CartService);
  previewer = inject(PreviewService);
  auth = inject(AuthService);
  private router = inject(Router);

  readonly freeShippingFrom = FREE_SHIPPING_FROM;
  readonly key = cartItemKey;

  // Newest lines first
  items = computed(() => [...this.cart.items()].reverse());
  missingForFreeShipping = computed(() =>
    Math.max(0, Math.round((FREE_SHIPPING_FROM - this.cart.subtotal()) * 100) / 100),
  );
  freeShippingProgress = computed(() =>
    Math.min(100, (this.cart.subtotal() / FREE_SHIPPING_FROM) * 100),
  );

  checkout() {
    this.cart.drawerOpen.set(false);
    this.router.navigate(['/checkout']);
  }

  browse() {
    this.cart.drawerOpen.set(false);
    this.router.navigate(['/store']);
  }
}
