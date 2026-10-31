import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  DEFAULT_DELIVERY_OPTIONS,
  DeliveryOption,
  DeliverySettings,
} from '../../models/delivery.model';

export type DeliveryOptionPayload = Omit<DeliveryOption, 'id'> & { id?: string };

// The shop's delivery options, set by the admins: the cart, the product pages and the
// checkout show them. The server charges from its own copy
@Injectable({
  providedIn: 'root',
})
export class DeliveryService {
  private http = inject(HttpClient);
  private apiUrl = 'api/delivery';

  readonly settings = signal<DeliverySettings>({
    configured: false,
    options: DEFAULT_DELIVERY_OPTIONS,
    updatedAt: null,
  });
  readonly options = computed(() => this.settings().options);
  // Lowest subtotal some option is free from, null when none ever is
  readonly freeShippingFrom = computed(() => {
    const amounts = this.options()
      .map((o) => o.freeFrom)
      .filter((amount): amount is number => amount != null);
    return amounts.length ? Math.min(...amounts) : null;
  });

  constructor() {
    // Pages rendered on the server show the defaults until the browser loads them
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.load().subscribe({
      error: (err) => console.error('Failed to load the delivery options', err),
    });
  }

  load(): Observable<DeliverySettings> {
    return this.http
      .get<DeliverySettings>(this.apiUrl)
      .pipe(tap((settings) => this.settings.set(settings)));
  }

  // Admin: replaces the options (orders already placed keep theirs)
  save(options: DeliveryOptionPayload[]): Observable<DeliverySettings> {
    return this.http
      .put<DeliverySettings>(this.apiUrl, { options })
      .pipe(tap((settings) => this.settings.set(settings)));
  }

  optionOf(id: string): DeliveryOption | undefined {
    return this.options().find((o) => o.id === id);
  }
}
