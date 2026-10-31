import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe } from '@ngx-translate/core';
import { OrdersService } from '../../services/orders/orders.service';
import { OrderModel } from '../../models/order.model';
import { EmptyComponent } from '../../components/empty/empty.component';
import { OrderCardComponent } from '../../components/order-card/order-card.component';

// Orders placed by the logged in user, newest first; each one unfolds into its details
@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    EmptyComponent,
    OrderCardComponent,
  ],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss',
})
export class MyOrdersComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private router = inject(Router);

  orders = signal<OrderModel[]>([]);
  loading = signal(true);
  failed = signal(false);
  // Ids of the unfolded orders
  open = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.ordersService.getMyOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        // The latest order starts unfolded
        this.open.set(new Set(orders.length ? [orders[0]._id] : []));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load the orders', err);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  toggle(id: string) {
    this.open.update((open) => {
      const next = new Set(open);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  goToStore() {
    this.router.navigate(['/stores']);
  }
}
