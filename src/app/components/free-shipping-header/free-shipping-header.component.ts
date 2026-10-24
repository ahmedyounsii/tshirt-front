import { Component, HostBinding } from '@angular/core';
import { PricePipe } from '../../shared/price.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { FREE_SHIPPING_FROM } from '../../shared/checkout.config';

@Component({
  selector: 'app-free-shipping-header',
  standalone: true,
  imports: [PricePipe, TranslatePipe],
  templateUrl: './free-shipping-header.component.html',
  styleUrl: './free-shipping-header.component.scss',
})
export class FreeShippingHeaderComponent {
  @HostBinding('class.hide') isHide = false;

  readonly freeShippingFrom = FREE_SHIPPING_FROM;

  hide() {
    this.isHide = true;
  }
}
