import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  OrderModel,
  OrderPayload,
  OrderPrintSheet,
  OrdersPage,
  OrdersQuery,
  OrderStatus,
} from '../../models/order.model';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private http = inject(HttpClient);
  private apiUrl = 'api/orders';

  // Admin only: orders waiting to be handled, shown as a badge on the account
  // button. Kept in sync by the admin calls below
  private pendingCountSignal = signal<number | null>(null);
  readonly pendingCount = this.pendingCountSignal.asReadonly();

  refreshPendingCount() {
    // Only the counts are needed: a one item page carries them
    this.getOrdersPage({ page: 1, size: 1, status: 'pending' }).subscribe({
      error: () => this.pendingCountSignal.set(null),
    });
  }

  // Orders everything in the user's cart (the server empties it)
  placeOrder(payload: OrderPayload): Observable<OrderModel> {
    return this.http.post<OrderModel>(this.apiUrl, payload);
  }

  getMyOrders(): Observable<OrderModel[]> {
    return this.http.get<OrderModel[]>(`${this.apiUrl}/mine`);
  }

  // Admin only: every order, filtered and paginated
  getOrdersPage(query: OrdersQuery): Observable<OrdersPage> {
    const params: Record<string, string> = {
      page: String(query.page),
      size: String(query.size),
    };
    if (query.status) params['status'] = query.status;
    if (query.search?.trim()) params['search'] = query.search.trim();
    return this.http.get<OrdersPage>(this.apiUrl, { params }).pipe(
      tap((data) => {
        // Counts ignore the status filter and always have "all" (missing ones are 0)
        if (data.counts.all !== undefined) {
          this.pendingCountSignal.set(data.counts.pending ?? 0);
        }
      }),
    );
  }

  // Admin only: the order with each item's print data, for the production sheet
  getPrintSheet(id: string): Observable<OrderPrintSheet> {
    return this.http.get<OrderPrintSheet>(`${this.apiUrl}/${id}/print`);
  }

  // Admin only
  updateStatus(id: string, status: OrderStatus): Observable<OrderModel> {
    // The previous status isn't known here, so the count is fetched again
    return this.http
      .patch<OrderModel>(`${this.apiUrl}/${id}/status`, { status })
      .pipe(tap(() => this.refreshPendingCount()));
  }

  // Admin only
  deleteOrder(id: string): Observable<{ message: string; order: OrderModel }> {
    return this.http
      .delete<{ message: string; order: OrderModel }>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(({ order }) => {
          if (order.status === 'pending') {
            this.pendingCountSignal.update((n) => (n ? n - 1 : n));
          }
        }),
      );
  }
}
