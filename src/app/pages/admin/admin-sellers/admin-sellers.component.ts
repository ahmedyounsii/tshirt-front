import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { CategoryChipsComponent, ChipItem } from '../../../components/category-chips/category-chips.component';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { SearchInputComponent } from '../../../components/search-input/search-input.component';
import { SellersPage } from '../../../models/seller.model';
import { MarketplaceService } from '../../../services/marketplace/marketplace.service';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { toneOf } from '../../../shared/marketplace';
import { PricePipe } from '../../../shared/price.pipe';

const PAGE_SIZE = 20;

// Admin: the sellers as cards with their balances; each opens its page (admin-seller) to record
// payouts or suspend it. The commission (admin-commission) and the audit log (admin-audit) have
// their own pages
@Component({
    selector: 'app-admin-sellers',
    imports: [
        RouterLink,
        TranslatePipe,
        SkeletonComponent,
        CategoryChipsComponent,
        EmptyComponent,
        SearchInputComponent,
        AvatarUrlPipe,
        PricePipe,
    ],
    templateUrl: './admin-sellers.component.html',
    styleUrl: './admin-sellers.component.scss'
})
export class AdminSellersComponent implements OnInit {
  private marketplace = inject(MarketplaceService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly toneOf = toneOf;

  // Sellers
  readonly page = signal<SellersPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly status = signal('');
  readonly search = signal('');
  readonly pageIndex = signal(1);

  readonly chips = computed<ChipItem[]>(() => {
    const counts = this.page()?.counts ?? {};
    return [
      { id: '', label: 'common.all', count: counts.all ?? 0 },
      { id: 'active', label: 'adminSellers.sellerStatus.active', count: counts.active ?? 0 },
      { id: 'suspended', label: 'adminSellers.sellerStatus.suspended', count: counts.suspended ?? 0 },
      { id: 'closed', label: 'adminSellers.sellerStatus.closed', count: counts.closed ?? 0 },
    ];
  });

  readonly pages = computed(() => {
    const page = this.page();
    return page ? Math.max(1, Math.ceil(page.count / page.size)) : 1;
  });

  ngOnInit() {
    if (!this.isBrowser) return;
    this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.marketplace
      .getSellers({ page: this.pageIndex(), size: PAGE_SIZE, status: this.status(), search: this.search() })
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
