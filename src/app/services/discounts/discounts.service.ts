import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActiveDiscount,
  ActiveDiscountsResponse,
  DiscountModel,
  DiscountPayload,
  Sale,
  salePrice,
  SaleProduct,
  TakenTargets,
} from '../../models/discount.model';

// setTimeout can't wait longer than ~24 days: further changes are picked up on the next visit
const MAX_TIMER_MS = 2 ** 31 - 1;

// Live discounts, applied to every price the shop shows (the server applies the same ones
// when an order is placed), and the scheduled ones announced on the home page
@Injectable({
  providedIn: 'root',
})
export class DiscountsService {
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private apiUrl = 'api/discounts';
  private baseUrl = environment.baseUrl;
  private timer?: ReturnType<typeof setTimeout>;

  readonly active = signal<ActiveDiscount[]>([]);
  // How far the server's clock is ahead of the browser's (ms): countdowns follow the server
  readonly clockOffset = signal(0);

  readonly live = computed(() => this.active().filter((d) => d.status === 'live'));
  // Cards of the home page, live ones first
  readonly homeCards = computed(() =>
    [...this.active()]
      .filter((d) => d.showOnHome)
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'live' ? -1 : 1)),
  );

  // Live discounts per product id, per category id and per collection id, for quick lookups
  private index = computed(() => {
    const byProduct = new Map<string, ActiveDiscount[]>();
    const byCategory = new Map<string, ActiveDiscount[]>();
    const byCollection = new Map<string, ActiveDiscount[]>();
    const add = (map: Map<string, ActiveDiscount[]>, key: string, d: ActiveDiscount) =>
      map.set(key, [...(map.get(key) ?? []), d]);
    for (const discount of this.live()) {
      for (const id of discount.productIds) add(byProduct, id, discount);
      for (const id of discount.categories) add(byCategory, id, discount);
      for (const collection of discount.collections) add(byCollection, collection._id, discount);
    }
    return { byProduct, byCategory, byCollection };
  });

  constructor() {
    // The API is only reachable from the browser
    if (this.isBrowser) this.reload();
  }

  now(): number {
    return Date.now() + this.clockOffset();
  }

  reload(): void {
    if (!this.isBrowser) return;
    this.http.get<ActiveDiscountsResponse>(`${this.apiUrl}/active`).subscribe({
      next: ({ serverTime, discounts }) => {
        this.clockOffset.set(new Date(serverTime).getTime() - Date.now());
        this.active.set(
          discounts.map((d) => ({
            ...d,
            previews: d.previews.map((p) => ({ ...p, url: `${this.baseUrl}${p.url}` })),
          })),
        );
        this.scheduleNextChange();
      },
      error: (err) => console.error('Failed to load the discounts', err),
    });
  }

  // The best live discount of a product, null when none lowers its price
  saleOf(product: SaleProduct | null | undefined): Sale | null {
    if (!product || product.price == null) return null;
    const { byProduct, byCategory } = this.index();
    const candidates = [
      ...(product._id ? byProduct.get(product._id) ?? [] : []),
      ...(product.category ? byCategory.get(product.category) ?? [] : []),
    ];
    let best: Sale | null = null;
    for (const discount of candidates) {
      const price = salePrice(product.price, discount);
      if (price < product.price && (!best || price < best.price)) {
        const off = Math.round((1 - price / product.price) * 100);
        best = { price, original: product.price, off, discount };
      }
    }
    return best;
  }

  // The live discount made on a collection (its products get it), shown on its cards and
  // banners; the biggest percentage first, else the biggest amount. null when none
  collectionSale(id: string | null | undefined): ActiveDiscount | null {
    if (!id) return null;
    const discounts = this.index().byCollection.get(id) ?? [];
    return discounts.reduce<ActiveDiscount | null>((best, discount) => {
      if (!best || (discount.kind === 'percent') !== (best.kind === 'percent')) {
        return !best || discount.kind === 'percent' ? discount : best;
      }
      return discount.value > best.value ? discount : best;
    }, null);
  }

  // Price charged per unit, discount included
  unitPrice(product: SaleProduct | null | undefined): number {
    return this.saleOf(product)?.price ?? product?.price ?? 0;
  }

  // ---------- Admin, and users on their own products ----------

  // Every discount (admin), or with mine only the logged in user's
  getDiscounts(mine = false): Observable<DiscountModel[]> {
    const params: Record<string, string> = mine ? { mine: 'true' } : {};
    return this.http.get<DiscountModel[]>(this.apiUrl, { params });
  }

  getDiscount(id: string): Observable<DiscountModel> {
    return this.http.get<DiscountModel>(`${this.apiUrl}/${id}`);
  }

  // What a new discount, or the one of the id being edited, can no longer pick
  getTaken(exclude?: string | null): Observable<TakenTargets> {
    const params: Record<string, string> = exclude ? { exclude } : {};
    return this.http.get<TakenTargets>(`${this.apiUrl}/taken`, { params });
  }

  createDiscount(payload: DiscountPayload): Observable<DiscountModel> {
    return this.http.post<DiscountModel>(this.apiUrl, payload).pipe(tap(() => this.reload()));
  }

  updateDiscount(id: string, payload: DiscountPayload): Observable<DiscountModel> {
    return this.http
      .put<DiscountModel>(`${this.apiUrl}/${id}`, payload)
      .pipe(tap(() => this.reload()));
  }

  // Pauses or resumes it
  setEnabled(id: string, enabled: boolean): Observable<DiscountModel> {
    return this.http
      .patch<DiscountModel>(`${this.apiUrl}/${id}/enabled`, { enabled })
      .pipe(tap(() => this.reload()));
  }

  deleteDiscount(id: string): Observable<{ message: string }> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(tap(() => this.reload()));
  }

  // Fetches again when the next discount starts or ends, so prices follow without a refresh
  private scheduleNextChange(): void {
    clearTimeout(this.timer);
    const now = this.now();
    const changes = this.active()
      .flatMap((d) => [d.startsAt, d.endsAt])
      .map((date) => (date ? new Date(date).getTime() - now : -1))
      .filter((ms) => ms > 0);
    if (!changes.length) return;
    const wait = Math.min(...changes) + 1000;
    if (wait < MAX_TIMER_MS) this.timer = setTimeout(() => this.reload(), wait);
  }
}
