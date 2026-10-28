import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  Observable,
  of,
  shareReplay,
  tap,
  timeout,
} from 'rxjs';

// Pages open while the shop is in maintenance: the page itself, and the login where
// admins sign in to reopen the shop
export const OPEN_DURING_MAINTENANCE = ['maintenance', 'auth'];

export interface MaintenanceState {
  enabled: boolean;
  since: string | null;
}

// Whether the shop is closed to the public. While it is, visitors get the maintenance
// page (see maintenanceGuard) and the api only answers admins
@Injectable({
  providedIn: 'root',
})
export class MaintenanceService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'api/maintenance';
  private inFlight?: Observable<MaintenanceState>;

  readonly state = signal<MaintenanceState | null>(null);
  readonly enabled = computed(() => !!this.state()?.enabled);

  // Asked again on every navigation (the startup mask waits for the first one), so a
  // visitor already browsing is stopped as soon as the shop closes; calls made while
  // one is on its way share it. Server unreachable or too slow: the last known state,
  // open on the first visit, the pages show their own errors
  load(): Observable<MaintenanceState> {
    this.inFlight ??= this.http.get<MaintenanceState>(this.apiUrl).pipe(
      timeout(8000),
      catchError(() => of(this.state() ?? { enabled: false, since: null })),
      tap((state) => this.state.set(state)),
      finalize(() => (this.inFlight = undefined)),
      shareReplay(1),
    );
    return this.inFlight;
  }

  // Admin: closes the shop to the public or reopens it
  setEnabled(enabled: boolean): Observable<MaintenanceState> {
    return this.http.put<MaintenanceState>(this.apiUrl, { enabled }).pipe(
      tap((state) => this.state.set(state)),
    );
  }

  // The api turned a request away: the shop went into maintenance while browsing.
  // The open pages stay put, their own requests (header, templates...) fail quietly
  turnedAway(): void {
    this.state.set({ enabled: true, since: this.state()?.since ?? null });
    if (!OPEN_DURING_MAINTENANCE.includes(this.currentPage())) {
      this.router.navigateByUrl('/maintenance');
    }
  }

  // First segment of the page shown, or of the one being opened: at startup the
  // requests fail while the first navigation is still running
  private currentPage(): string {
    const url =
      this.router.getCurrentNavigation()?.extractedUrl ??
      this.router.parseUrl(this.router.url);
    return url.root.children['primary']?.segments[0]?.path ?? '';
  }
}
