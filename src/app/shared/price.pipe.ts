import { Pipe, PipeTransform } from '@angular/core';
import { formatPrice } from './currency.config';

// {{ product.price | price }} or, without cents, {{ amount | price: "1.0-0" }}
@Pipe({
  name: 'price',
  standalone: true,
})
export class PricePipe implements PipeTransform {
  transform(value?: number | null, digitsInfo?: string): string {
    return value == null ? '' : formatPrice(value, digitsInfo);
  }
}
