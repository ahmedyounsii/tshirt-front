import { Component } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';

@Component({
  selector: 'app-cart-summary',
  standalone: true,
  imports: [DrawerModule],
  templateUrl: './cart-summary.component.html',
  styleUrl: './cart-summary.component.scss',
})
export class CartSummaryComponent {
  visible = false;
  items = null;
}
