import { Component, HostBinding, inject } from '@angular/core';
import { PricePipe } from '../../shared/price.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { DeliveryService } from '../../services/delivery/delivery.service';

@Component({
    selector: 'app-free-shipping-header',
    imports: [PricePipe, TranslatePipe],
    templateUrl: './free-shipping-header.component.html',
    styleUrl: './free-shipping-header.component.scss'
})
export class FreeShippingHeaderComponent {
  isHide = false;

  // Lowest amount some delivery option is free from; the banner hides when none is
  readonly freeShippingFrom = inject(DeliveryService).freeShippingFrom;

  @HostBinding('class.hide') get hidden(): boolean {
    return this.isHide || this.freeShippingFrom() == null;
  }

  hide() {
    this.isHide = true;
  }
}
