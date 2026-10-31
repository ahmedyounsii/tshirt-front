import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, Subscription, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OrdersService } from '../../services/orders/orders.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { LanguageService } from '../../services/language.service';
import {
  ORDER_STATUSES,
  OrderModel,
  OrdersPage,
  OrderStatus,
} from '../../models/order.model';
import {
  CategoryChipsComponent,
  ChipItem,
} from '../../components/category-chips/category-chips.component';
import { SearchInputComponent } from '../../components/search-input/search-input.component';
import { EmptyComponent } from '../../components/empty/empty.component';
import { OrderCardComponent } from '../../components/order-card/order-card.component';
import { IconComponent } from '../../components/icon/icon.component';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { PricePipe } from '../../shared/price.pipe';
import {
  ProductDetails,
  ProductDetailsDialogComponent,
} from '../../components/product-details-dialog/product-details-dialog.component';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { ProductModel } from '../../models/product.model';
import { environment } from '../../../environments/environment';

const ALL = 'all';
const PAGE_SIZE = 20;

// Admin: every order of the shop, filtered by status and searchable; each one's
// status can be changed, units of a delivered order refunded, and the order deleted
@Component({
  selector: 'app-manage-orders',
  standalone: true,
  imports: [
    IconComponent,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    SelectModule,
    SkeletonModule,
    CategoryChipsComponent,
    SearchInputComponent,
    EmptyComponent,
    OrderCardComponent,
    DialogComponent,
    PricePipe,
    ProductDetailsDialogComponent,
  ],
  templateUrl: './manage-orders.component.html',
  styleUrl: './manage-orders.component.scss',
})
export class ManageOrdersComponent implements OnInit, OnDestroy {
  private ordersService = inject(OrdersService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private categoriesService = inject(CategoriesService);

  orders = signal<OrderModel[]>([]);
  // Refund dialog: the order, and the units to refund per item index
  refunding = signal<OrderModel | null>(null);
  refundOpen = signal(false);
  refundQuantities: Record<number, number> = {};
  refundError = signal<string | null>(null);
  // Custom design being saved as a product: its details dialog is open
  savingDesign = signal<{ order: OrderModel; index: number } | null>(null);
  // What the details dialog shows of it, prefilled with its name
  designProduct = computed<ProductModel | null>(() => {
    const saving = this.savingDesign();
    const item = saving?.order.items[saving.index];
    return item
      ? { label: item.label, url: environment.baseUrl + item.url, tags: [] }
      : null;
  });
  categories: DesignCategoryModel[] = [];
  count = signal(0);
  counts = signal<OrdersPage['counts']>({});
  page = signal(1);
  loading = signal(true);
  loadingMore = signal(false);
  failed = signal(false);
  // Last failed status change or delete, shown above the list
  error = signal<string | null>(null);

  status = signal<string>(ALL);
  search = signal('');
  open = signal<ReadonlySet<string>>(new Set());
  // Orders with a status change or delete on its way
  busy = signal<ReadonlySet<string>>(new Set());

  hasMore = computed(() => this.orders().length < this.count());
  filtered = computed(() => this.status() !== ALL || !!this.search().trim());

  chips = computed<ChipItem[]>(() => {
    const counts = this.counts();
    // Counts are hidden until the first page brings them (it always has "all")
    const known = counts.all !== undefined;
    return [
      { id: ALL, label: 'common.all', count: known ? counts.all : undefined },
      ...ORDER_STATUSES.map((s) => ({
        id: s,
        label: `orders.status.${s}`,
        count: known ? (counts[s] ?? 0) : undefined,
      })),
    ];
  });

  // Labels follow the UI language
  statusOptions = computed(() => {
    this.language.current();
    return ORDER_STATUSES.map((s) => ({
      value: s,
      label: this.translate.instant(`orders.status.${s}`),
    }));
  });

  private request?: Subscription;

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  onStatusFilter(status: string) {
    this.status.set(status);
    this.reload();
  }

  onSearch(search: string) {
    this.search.set(search);
    this.reload();
  }

  reload() {
    this.page.set(1);
    this.loading.set(true);
    this.failed.set(false);
    this.fetch(1, (items) => this.orders.set(items));
  }

  loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const next = this.page() + 1;
    this.fetch(next, (items) => {
      this.page.set(next);
      // Skips orders already shown, in case new ones shifted the pages
      const shown = new Set(this.orders().map((o) => o._id));
      this.orders.update((orders) => [...orders, ...items.filter((o) => !shown.has(o._id))]);
    });
  }

  toggle(id: string) {
    this.open.update((open) => toggled(open, id));
  }

  changeStatus(order: OrderModel, status: OrderStatus) {
    if (status === order.status || this.busy().has(order._id)) return;
    const previous = order.status;
    this.error.set(null);
    this.setBusy(order._id, true);
    // Shown right away, put back if the server refuses
    this.replace({ ...order, status });
    this.moveCount(previous, status);
    this.ordersService.updateStatus(order._id, status).subscribe({
      next: (updated) => {
        this.setBusy(order._id, false);
        this.replace(updated);
      },
      error: (err) => {
        console.error('Failed to update the order status', err);
        this.setBusy(order._id, false);
        this.replace({ ...order, status: previous });
        this.moveCount(status, previous);
        this.error.set(this.translate.instant('adminOrders.statusFailed'));
      },
    });
  }

  async remove(order: OrderModel) {
    if (this.busy().has(order._id)) return;
    const accepted = await this.confirm.confirmDelete(
      this.translate.instant('adminOrders.deleteConfirm', { number: order.number }),
      this.translate.instant('adminOrders.deleteHeader'),
    );
    if (!accepted) return;
    this.error.set(null);
    this.setBusy(order._id, true);
    this.ordersService.deleteOrder(order._id).subscribe({
      next: () => {
        this.setBusy(order._id, false);
        this.orders.update((orders) => orders.filter((o) => o._id !== order._id));
        this.count.update((c) => Math.max(c - 1, 0));
        this.counts.update((counts) => ({
          ...counts,
          all: Math.max((counts.all ?? 1) - 1, 0),
          [order.status]: Math.max((counts[order.status] ?? 1) - 1, 0),
        }));
      },
      error: (err) => {
        console.error('Failed to delete the order', err);
        this.setBusy(order._id, false);
        // Paid seller earnings: the order must be cancelled, not deleted
        this.error.set(
          this.translate.instant(
            err.error?.code === 'hasEarnings' ? 'adminOrders.deleteHasEarnings' : 'adminOrders.deleteFailed',
          ),
        );
      },
    });
  }

  openRefund(order: OrderModel) {
    this.refunding.set(order);
    this.refundQuantities = {};
    this.refundError.set(null);
    this.refundOpen.set(true);
  }

  refundable(item: OrderModel['items'][number]): number {
    return item.quantity - (item.refundedQuantity ?? 0);
  }

  // Units of one item, one request: the seller's share is taken back by the server
  refund(index: number) {
    const order = this.refunding();
    const item = order?.items[index];
    const quantity = Math.floor(Number(this.refundQuantities[index]) || 0);
    if (!order || !item) return;
    if (quantity < 1 || quantity > this.refundable(item)) {
      this.refundError.set(this.translate.instant('adminOrders.refund.invalid', { max: this.refundable(item) }));
      return;
    }
    this.refundError.set(null);
    this.setBusy(order._id, true);
    this.ordersService.refundItem(order._id, index, quantity, item.refundedQuantity ?? 0).subscribe({
      next: (updated) => {
        this.setBusy(order._id, false);
        this.replace(updated);
        this.refunding.set(updated);
        this.refundQuantities = {};
      },
      error: (err) => {
        this.setBusy(order._id, false);
        this.refundError.set(err.error?.message || this.translate.instant('adminOrders.refund.failed'));
      },
    });
  }

  // Opens the details dialog (name, category, tags) to make the custom design of an item
  // a shop product, sold at the price list
  saveDesign(order: OrderModel, index: number) {
    if (this.savingDesign()) return;
    this.error.set(null);
    if (!this.categories.length) {
      this.categoriesService.getAllCategories().subscribe({
        next: (categories) => (this.categories = categories),
        error: (err) => console.error('Failed to load categories', err),
      });
    }
    this.savingDesign.set({ order, index });
  }

  // The dialog's save: the order comes back with its items marked
  readonly submitDesign = (details: ProductDetails) => {
    const { order, index } = this.savingDesign()!;
    return this.ordersService.saveItemAsProduct(order._id, index, details).pipe(
      tap(({ order: updated }) => this.replace(updated)),
      map(({ product }) => product),
    );
  };

  private fetch(page: number, apply: (items: OrderModel[]) => void) {
    const status = this.status();
    // A newer filter or page wins over a response still on its way
    this.request?.unsubscribe();
    this.request = this.ordersService
      .getOrdersPage({
        page,
        size: PAGE_SIZE,
        status: status === ALL ? undefined : (status as OrderStatus),
        search: this.search(),
      })
      .subscribe({
        next: (data) => {
          apply(data.items);
          this.count.set(data.count);
          this.counts.set(data.counts);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (err) => {
          console.error('Failed to load the orders', err);
          if (page === 1) this.failed.set(true);
          else this.error.set(this.translate.instant('adminOrders.loadFailed'));
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  private replace(order: OrderModel) {
    this.orders.update((orders) => orders.map((o) => (o._id === order._id ? order : o)));
  }

  private moveCount(from: OrderStatus, to: OrderStatus) {
    this.counts.update((counts) => ({
      ...counts,
      [from]: Math.max((counts[from] ?? 1) - 1, 0),
      [to]: (counts[to] ?? 0) + 1,
    }));
  }

  private setBusy(id: string, busy: boolean) {
    this.busy.update((set) => (set.has(id) === busy ? set : toggled(set, id)));
  }
}

const toggled = (set: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
};
