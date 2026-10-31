import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { PricePipe } from '../../shared/price.pipe';
import { SalePriceComponent } from '../../shared/sale-price/sale-price.component';
import { DiscountsService } from '../../services/discounts/discounts.service';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { TranslatePipe } from '@ngx-translate/core';
import { CartService } from '../../services/cart/cart.service';
import {
  MAX_QUANTITY,
  SizeQuantity,
  PRODUCT_SIZES,
  ProductSize,
} from '../../models/cart.model';
import { TemplatesService } from '../../services/templates/templates.service';
import { SIZE_GUIDE } from '../../shared/checkout.config';
import { DeliveryService } from '../../services/delivery/delivery.service';
import { QtyStepperComponent } from '../qty-stepper/qty-stepper.component';
import { PreviewService } from '../../services/preview/preview.service';

// "Shop now" of a product card: pick how many of each size, then add them to the cart.
// Rendered once in the app root, opened with CartService.openPicker()
@Component({
    selector: 'app-shop-now-dialog',
    imports: [
        SalePriceComponent,
        PricePipe,
        TranslatePipe,
        DialogComponent,
        QtyStepperComponent,
    ],
    templateUrl: './shop-now-dialog.component.html',
    styleUrl: './shop-now-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopNowDialogComponent {
  cart = inject(CartService);
  private discounts = inject(DiscountsService);
  previewer = inject(PreviewService);
  private templatesService = inject(TemplatesService);

  readonly sizes = PRODUCT_SIZES;
  readonly sizeGuide = SIZE_GUIDE;
  // Lowest amount some delivery option is free from, null when none is
  readonly freeShippingFrom = inject(DeliveryService).freeShippingFrom;

  quantities = signal<Partial<Record<ProductSize, number>>>({});
  side = signal<'front' | 'back'>('front');
  showGuide = signal(false);
  adding = signal(false);
  failed = signal(false);

  picks = computed<SizeQuantity[]>(() =>
    this.sizes
      .map((size) => ({ size, quantity: this.quantities()[size] ?? 0 }))
      .filter((p) => p.quantity > 0),
  );
  totalQuantity = computed(() => this.picks().reduce((sum, p) => sum + p.quantity, 0));
  // Discount included
  total = computed(() => this.discounts.unitPrice(this.cart.picking()) * this.totalQuantity());

  template = computed(() => {
    const product = this.cart.picking();
    return this.templatesService.byId(product?.templateId) ?? product?.template ?? null;
  });

  constructor() {
    // Every product opens with a clean selection
    effect(
      () => {
        this.cart.picking();
        untracked(() => {
          this.quantities.set({});
          this.side.set('front');
          this.showGuide.set(false);
          this.failed.set(false);
        });
      },
      { allowSignalWrites: true },
    );
  }

  quantity(size: ProductSize): number {
    return this.quantities()[size] ?? 0;
  }

  inCart(size: ProductSize): number {
    return this.cart.quantityOf(this.cart.picking()?._id, size);
  }

  // What can still be added on top of what's already in the cart
  maxFor(size: ProductSize): number {
    return Math.max(0, MAX_QUANTITY - this.inCart(size));
  }

  setQuantity(size: ProductSize, quantity: number) {
    this.failed.set(false);
    this.quantities.update((q) => ({ ...q, [size]: Math.max(0, quantity) }));
  }

  close() {
    if (this.adding()) return;
    this.cart.closePicker();
  }

  async apply() {
    const product = this.cart.picking();
    if (!product || !this.totalQuantity() || this.adding()) return;
    this.adding.set(true);
    this.failed.set(false);
    try {
      await this.cart.add(product, this.picks());
      this.adding.set(false);
      this.cart.closePicker();
    } catch (err) {
      console.error('Failed to add to the cart', err);
      this.adding.set(false);
      this.failed.set(true);
    }
  }
}
