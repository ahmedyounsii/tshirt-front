import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';
import { PreviewService } from '../../services/preview/preview.service';
import { OrderItem, OrderModel, OrderStatus } from '../../models/order.model';
import { arrivalRange, deliveryOptionOf } from '../../shared/checkout.config';
import { environment } from '../../../environments/environment';

// Statuses where the order is still on its way, so an arrival estimate makes sense
const IN_PROGRESS: OrderStatus[] = ['pending', 'confirmed', 'shipped'];

// One order: a summary row that unfolds into the items, address and totals.
// Content marked [cardActions] shows between the two (the admin's controls)
@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CurrencyPipe, TranslatePipe],
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.scss',
  host: { class: 'order', '[class.open]': 'expanded' },
})
export class OrderCardComponent {
  @Input({ required: true }) order!: OrderModel;
  @Input() expanded = false;
  @Output() toggle = new EventEmitter<void>();

  private language = inject(LanguageService);
  private previewer = inject(PreviewService);
  readonly baseUrl = environment.baseUrl;

  // Item urls are stored relative: the previewer needs them absolute
  preview(item: OrderItem) {
    this.previewer.open({
      url: this.baseUrl + item.url,
      backUrl: item.backUrl ? this.baseUrl + item.backUrl : null,
    });
  }

  date(): string {
    return new Date(this.order.createdAt).toLocaleDateString(this.language.current(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  inProgress(): boolean {
    return IN_PROGRESS.includes(this.order.status);
  }

  arrival(): string {
    return arrivalRange(
      deliveryOptionOf(this.order.delivery),
      new Date(this.order.createdAt),
      this.language.current(),
    );
  }

  itemsCount(): number {
    return this.order.items.reduce((sum, i) => sum + i.quantity, 0);
  }
}
