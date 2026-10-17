import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  CustomPricedProduct,
  PricingModel,
  PricingSaveResult,
  PricingStats,
} from '../../models/pricing.model';

export type PricingPayload = Pick<PricingModel, 'styles' | 'designPrice' | 'textPrice'>;

@Injectable({
  providedIn: 'root',
})
export class PricingService {
  private http = inject(HttpClient);
  private apiUrl = 'api/pricing';

  // Last price list fetched or saved, shared by the designer and the admin page
  readonly pricing = signal<PricingModel | null>(null);

  getPricing(): Observable<PricingModel> {
    return this.http
      .get<PricingModel>(this.apiUrl)
      .pipe(tap((pricing) => this.pricing.set(pricing)));
  }

  // Admin: products per style, and how many have a custom price
  getStats(): Observable<PricingStats> {
    return this.http.get<PricingStats>(`${this.apiUrl}/stats`);
  }

  // Admin: products priced by hand, newest first
  getCustomPriced(): Observable<CustomPricedProduct[]> {
    return this.http.get<CustomPricedProduct[]>(`${this.apiUrl}/custom`);
  }

  // Admin: saves the price list; every product following it is repriced
  savePricing(pricing: PricingPayload): Observable<PricingSaveResult> {
    return this.http
      .put<PricingSaveResult>(this.apiUrl, pricing)
      .pipe(tap((result) => this.pricing.set(result.pricing)));
  }

  // Admin: drops every custom price, all products follow the price list again
  resetCustomPrices(): Observable<{ reset: number; repriced: number; stats: PricingStats }> {
    return this.http.delete<{ reset: number; repriced: number; stats: PricingStats }>(
      `${this.apiUrl}/custom`,
    );
  }
}
