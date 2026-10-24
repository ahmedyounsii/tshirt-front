import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { PricePipe } from '../../shared/price.pipe';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { CartItem, MAX_QUANTITY } from '../../models/cart.model';
import { CartService } from '../../services/cart/cart.service';
import { PreviewService } from '../../services/preview/preview.service';
import { TemplatesService } from '../../services/templates/templates.service';
import { QtyStepperComponent } from '../qty-stepper/qty-stepper.component';

// One cart line: thumbnail, size, quantity and price. Editable in the drawer and the
// first checkout step, read only on the review step
@Component({
  selector: 'app-cart-line',
  standalone: true,
  imports: [PricePipe, TranslatePipe, ButtonModule, QtyStepperComponent],
  templateUrl: './cart-line.component.html',
  styleUrl: './cart-line.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.highlighted]': 'highlighted',
    '[class.readonly]': '!editable',
  },
})
export class CartLineComponent {
  cart = inject(CartService);
  previewer = inject(PreviewService);
  private templatesService = inject(TemplatesService);

  @Input({ required: true }) item!: CartItem;
  @Input() editable = true;
  @Input() highlighted = false;

  readonly maxQuantity = MAX_QUANTITY;

  get template() {
    const id = this.item.product.templateId;
    return this.templatesService.byId(id) ?? this.item.product.template ?? null;
  }

  get lineTotal(): number {
    return (this.item.product.price ?? 0) * this.item.quantity;
  }

  onQuantity(quantity: number) {
    if (quantity < 1) this.cart.remove(this.item);
    else this.cart.setQuantity(this.item, quantity);
  }
}
