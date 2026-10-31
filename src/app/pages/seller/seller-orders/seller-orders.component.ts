import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { CategoryChipsComponent, ChipItem } from '../../../components/category-chips/category-chips.component';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { SearchInputComponent } from '../../../components/search-input/search-input.component';
import { SellerOrdersPage } from '../../../models/seller.model';
import { SellerService } from '../../../services/seller/seller.service';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { toneOf } from '../../../shared/marketplace';
import { PricePipe } from '../../../shared/price.pipe';

const PAGE_SIZE = 15;
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

// Seller: the orders holding their items, with only those items (an order may hold other
// sellers' products too). The shop prints and ships every order, so the seller follows them
// here (status, refunds, what each item earns) without the customer's personal details
@Component({
    selector: 'app-seller-orders',
    imports: [
        DatePipe,
        TranslatePipe,
        SkeletonComponent,
        CategoryChipsComponent,
        EmptyComponent,
        SearchInputComponent,
        AvatarUrlPipe,
        PricePipe,
    ],
    templateUrl: './seller-orders.component.html',
    styleUrl: './seller-orders.component.scss'
})
export class SellerOrdersComponent implements OnInit {
  private sellerService = inject(SellerService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly toneOf = toneOf;

  readonly page = signal<SellerOrdersPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly status = signal('');
  readonly search = signal('');
  readonly pageIndex = signal(1);

  readonly chips = computed<ChipItem[]>(() => {
    const counts = this.page()?.counts ?? {};
    return [
      { id: '', label: 'common.all', count: counts.all ?? 0 },
      ...ORDER_STATUSES.map((s) => ({
        id: s,
        label: `orders.status.${s}`,
        count: counts[s as keyof typeof counts] ?? 0,
      })),
    ];
  });

  readonly pages = computed(() => {
    const page = this.page();
    return page ? Math.max(1, Math.ceil(page.count / page.size)) : 1;
  });

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.sellerService
      .getOrders({ page: this.pageIndex(), size: PAGE_SIZE, status: this.status(), search: this.search() })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  onStatus(status: string) {
    this.status.set(status);
    this.pageIndex.set(1);
    this.load();
  }

  onSearch(search: string) {
    this.search.set(search);
    this.pageIndex.set(1);
    this.load();
  }

  goTo(page: number) {
    this.pageIndex.set(page);
    this.load();
  }
}
