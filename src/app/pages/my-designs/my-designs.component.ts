import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe } from '@ngx-translate/core';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { AuthService } from '../../services/auth/auth.service';
import { ProductsService } from '../../services/products/products.service';
import { OrdersService } from '../../services/orders/orders.service';
import { LanguageService } from '../../services/language.service';

// Profile of the logged in user, Instagram like: identity and totals, then the
// grid of the products they saved
@Component({
  selector: 'app-my-designs',
  standalone: true,
  imports: [
    TranslatePipe,
    NgTemplateOutlet,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    ProductGalleryComponent,
  ],
  templateUrl: './my-designs.component.html',
  styleUrl: './my-designs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDesignsComponent implements OnInit {
  auth = inject(AuthService);
  private productsService = inject(ProductsService);
  private ordersService = inject(OrdersService);
  private language = inject(LanguageService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Null while loading
  productCount = signal<number | null>(null);
  orderCount = signal<number | null>(null);
  // Categories holding at least one of the user's products
  categoryCount = signal<number | null>(null);

  initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    return (user.name || user.username || user.email)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  });

  // "@username", the name for accounts made before usernames
  handle = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    return user.username ? `@${user.username}` : user.name;
  });

  // e.g. "October 2026", in the UI language
  memberSince = computed(() => {
    const createdAt = this.auth.user()?.createdAt;
    const time = createdAt ? Date.parse(createdAt) : NaN;
    if (Number.isNaN(time)) return '';
    return new Intl.DateTimeFormat(this.language.current(), {
      month: 'long',
      year: 'numeric',
    }).format(time);
  });

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.loadStats();
    this.ordersService.getMyOrders().subscribe({
      next: (orders) => this.orderCount.set(orders.length),
      error: () => this.orderCount.set(0),
    });
  }

  // Totals without any filter: a one item page carries them
  loadStats() {
    this.productsService.getProductsPage({ mine: true, page: 1, size: 1 }).subscribe({
      next: (data) => {
        const counts = data.counts || {};
        this.productCount.set(counts['all'] ?? data.count);
        this.categoryCount.set(
          Object.entries(counts).filter(([id, n]) => id !== 'all' && n > 0).length,
        );
      },
      error: () => {
        this.productCount.set(0);
        this.categoryCount.set(0);
      },
    });
  }
}
