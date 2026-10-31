import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  ApplicationPayload,
  browserTimeZone,
  LedgerQuery,
  MyApplication,
  SellerApplication,
  SellerDesignsPage,
  SellerEarnings,
  SellerOrdersPage,
  SellerOverview,
  SellerProductsPage,
} from '../../models/seller.model';
import { StoreModel } from '../../models/store.model';
import { UserModel } from '../../models/user.model';
import { AuthService } from '../auth/auth.service';

// Params without the empty values
export const paramsOf = (query: Record<string, string | number | undefined | null>): HttpParams => {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
};

// The logged-in user's side of the marketplace: their seller application and activation,
// then their seller dashboard. Every answer is scoped to them by the server
@Injectable({
  providedIn: 'root',
})
export class SellerService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private applicationsUrl = 'api/seller-applications';
  private apiUrl = 'api/seller';

  getMyApplication(): Observable<MyApplication> {
    return this.http.get<MyApplication>(`${this.applicationsUrl}/mine`);
  }

  // logo: a square made by prepareAvatar, optional
  apply(payload: ApplicationPayload, logo?: Blob | null): Observable<SellerApplication> {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) if (value) form.append(key, value);
    if (logo) form.append('logo', logo, logo.type === 'image/webp' ? 'logo.webp' : 'logo.jpg');
    return this.http.post<SellerApplication>(this.applicationsUrl, form);
  }

  // On success the session's user becomes a seller right away
  activate(code: string): Observable<{ user: UserModel; application: SellerApplication }> {
    return this.http
      .post<{ user: UserModel; application: SellerApplication }>(`${this.applicationsUrl}/activate`, { code })
      .pipe(tap(({ user }) => this.auth.setUser(user)));
  }

  getOverview(days: number): Observable<SellerOverview> {
    return this.http.get<SellerOverview>(`${this.apiUrl}/overview`, {
      params: paramsOf({ days, tz: browserTimeZone() }),
    });
  }

  getProducts(query: {
    page: number;
    size: number;
    search?: string;
    visibility?: 'published' | 'hidden' | '';
  }): Observable<SellerProductsPage> {
    return this.http.get<SellerProductsPage>(`${this.apiUrl}/products`, { params: paramsOf(query) });
  }

  getDesigns(query: { page: number; size: number; search?: string }): Observable<SellerDesignsPage> {
    return this.http.get<SellerDesignsPage>(`${this.apiUrl}/designs`, { params: paramsOf(query) });
  }

  getOrders(query: { page: number; size: number; status?: string; search?: string }): Observable<SellerOrdersPage> {
    return this.http.get<SellerOrdersPage>(`${this.apiUrl}/orders`, { params: paramsOf(query) });
  }

  getEarnings(query: LedgerQuery): Observable<SellerEarnings> {
    return this.http.get<SellerEarnings>(`${this.apiUrl}/earnings`, {
      params: paramsOf({ ...query, tz: browserTimeZone() }),
    });
  }

  // Pauses the store (its products leave the shop) or opens it again
  setPaused(paused: boolean): Observable<UserModel> {
    return this.http
      .put<UserModel>(`${this.apiUrl}/store/status`, { paused })
      .pipe(tap((user) => this.auth.setUser(user)));
  }

  // Deletes the store: confirm is its name. Seller access ends; earnings are kept
  closeStore(confirm: string): Observable<UserModel> {
    return this.http
      .delete<UserModel>(`${this.apiUrl}/store`, { body: { confirm } })
      .pipe(tap((user) => this.auth.setUser(user)));
  }

  getStore(): Observable<StoreModel> {
    return this.http.get<StoreModel>(`${this.apiUrl}/store`);
  }

  // logo: a new square (prepareAvatar), null to remove it, undefined to keep it
  saveStore(fields: { name: string; description: string }, logo?: Blob | null): Observable<StoreModel> {
    const form = new FormData();
    form.append('name', fields.name);
    form.append('description', fields.description);
    if (logo) form.append('logo', logo, logo.type === 'image/webp' ? 'logo.webp' : 'logo.jpg');
    else if (logo === null) form.append('removeLogo', 'true');
    return this.http.put<StoreModel>(`${this.apiUrl}/store`, form);
  }
}
