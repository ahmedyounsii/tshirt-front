import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PricePipe } from '../price.pipe';
import { SaleProduct } from '../../models/discount.model';
import { DiscountsService } from '../../services/discounts/discounts.service';

// Price of a product with its live discount: the sale price, the struck original and
// the percentage saved. The host carries the font of the price it replaces
// (<app-sale-price class="pd-price" [product]="product" />); quantity shows a line total
@Component({
  selector: 'app-sale-price',
  standalone: true,
  imports: [PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.on-sale]': '!!sale()' },
  template: `
    @if (sale(); as s) {
      <span class="sale-now">{{ s.price * quantity() | price }}</span>
      <s class="sale-was">{{ s.original * quantity() | price }}</s>
      @if (badge()) {
        <span class="sale-off">-{{ s.off }}%</span>
      }
    } @else if (product()?.price != null) {
      <span class="sale-now">{{ product()!.price! * quantity() | price }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0 0.4em;
      min-width: 0;
    }
    :host(.on-sale) .sale-now {
      color: var(--sale-color, var(--p-red-500));
    }
    .sale-was {
      font-size: 0.78em;
      font-weight: 500;
      color: var(--p-app-surface-500);
    }
    .sale-off {
      align-self: center;
      padding: 1px 6px;
      font-size: max(0.62em, 10px);
      font-weight: 800;
      line-height: 1.5;
      letter-spacing: 0.02em;
      color: #fff;
      background: var(--sale-color, var(--p-red-500));
      border-radius: 6px;
    }
  `,
})
export class SalePriceComponent {
  private discounts = inject(DiscountsService);

  readonly product = input.required<SaleProduct | null | undefined>();
  readonly quantity = input(1);
  // The "-30%" chip
  readonly badge = input(true);

  readonly sale = computed(() => this.discounts.saleOf(this.product()));
}
