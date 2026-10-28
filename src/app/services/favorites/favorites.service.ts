import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';

// Products hearted by the logged in user, kept on their account (the favorites page).
// Logged out users have none: the heart is only shown once logged in
@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private apiUrl = 'api/users/me/favorites';

  private idsSignal = signal<ReadonlySet<string>>(new Set());
  readonly ids = this.idsSignal.asReadonly();
  readonly count = computed(() => this.idsSignal().size);

  constructor() {
    if (!this.isBrowser) return;
    // Fetched for each account that logs in, cleared on logout
    effect(
      () => {
        const userId = this.auth.user()?._id;
        untracked(() => (userId ? this.load() : this.idsSignal.set(new Set())));
      },
      { allowSignalWrites: true },
    );
  }

  has(productId: string | undefined): boolean {
    return !!productId && this.idsSignal().has(productId);
  }

  // Switched right away, put back if the server refuses. Resolves once saved (or reverted)
  async toggle(productId: string): Promise<void> {
    const adding = !this.has(productId);
    this.set(productId, adding);
    try {
      const url = `${this.apiUrl}/${productId}`;
      const ids = await firstValueFrom(
        adding ? this.http.put<string[]>(url, {}) : this.http.delete<string[]>(url),
      );
      this.idsSignal.set(new Set(ids));
    } catch (err) {
      console.error('Failed to update the favorites', err);
      this.set(productId, !adding);
    }
  }

  // A deleted product: the server already took it out of every favorites list
  forget(productId: string) {
    this.set(productId, false);
  }

  private load() {
    this.http.get<string[]>(this.apiUrl).subscribe({
      next: (ids) => this.idsSignal.set(new Set(ids)),
      error: (err) => console.error('Failed to load the favorites', err),
    });
  }

  private set(productId: string, favorite: boolean) {
    const ids = new Set(this.idsSignal());
    if (favorite) ids.add(productId);
    else ids.delete(productId);
    this.idsSignal.set(ids);
  }
}
