import { Component, HostBinding } from '@angular/core';

@Component({
  selector: 'app-free-shipping-header',
  standalone: true,
  imports: [],
  templateUrl: './free-shipping-header.component.html',
  styleUrl: './free-shipping-header.component.scss',
})
export class FreeShippingHeaderComponent {
  @HostBinding('class.hide') isHide = false;

  hide() {
    this.isHide = true;
  }
}
