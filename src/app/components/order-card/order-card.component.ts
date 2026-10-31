import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagComponent } from '../tag/tag.component';
import { PricePipe } from '../../shared/price.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';
import { PreviewService } from '../../services/preview/preview.service';
import { OrderItem, OrderModel, OrderStatus } from '../../models/order.model';
import { arrivalRange, orderDeliveryOf } from '../../shared/checkout.config';
import { environment } from '../../../environments/environment';

// Statuses where the order is still on its way, so an arrival estimate makes sense
const IN_PROGRESS: OrderStatus[] = ['pending', 'confirmed', 'shipped'];

// One order: a summary row that unfolds into the items, address and totals.
// Content marked [cardActions] shows between the two (the admin's controls)
@Component({
    selector: 'app-order-card',
    imports: [PricePipe, TranslatePipe, RouterLink, TagComponent],
    templateUrl: './order-card.component.html',
    styleUrl: './order-card.component.scss',
    host: { class: 'order', '[class.open]': 'expanded' }
})
export class OrderCardComponent {
  @Input({ required: true }) order!: OrderModel;
  @Input() expanded = false;
  @Output() toggle = new EventEmitter<void>();
  // Admin: custom designs can be saved as shop products (index of the item being saved:
  // the buttons wait for it)
  @Input() canSaveDesigns = false;
  @Input() savingItem: number | null = null;
  @Output() saveDesign = new EventEmitter<number>();

  private language = inject(LanguageService);
  private previewer = inject(PreviewService);
  readonly baseUrl = environment.baseUrl;

  // Item urls are stored relative: the previewer needs them absolute
  preview(item: OrderItem) {
    this.previewer.open({
      ...item.print,
      templateId: item.templateId,
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
      orderDeliveryOf(this.order),
      new Date(this.order.createdAt),
      this.language.current(),
    );
  }

  itemsCount(): number {
    return this.order.items.reduce((sum, i) => sum + i.quantity, 0);
  }
}
