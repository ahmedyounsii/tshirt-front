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

// Ids hearted by the logged in user, kept on their account (the favorites page).
// Logged out users have none: the heart is only shown once logged in
abstract class FavoriteIds {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private idsSignal = signal<ReadonlySet<string>>(new Set());
  readonly ids = this.idsSignal.asReadonly();
  readonly count = computed(() => this.idsSignal().size);

  constructor(private apiUrl: string) {
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

  has(id: string | undefined): boolean {
    return !!id && this.idsSignal().has(id);
  }

  // Switched right away, put back if the server refuses. Resolves once saved (or reverted)
  async toggle(id: string): Promise<void> {
    const adding = !this.has(id);
    this.set(id, adding);
    try {
      const url = `${this.apiUrl}/${id}`;
      const ids = await firstValueFrom(
        adding ? this.http.put<string[]>(url, {}) : this.http.delete<string[]>(url),
      );
      this.idsSignal.set(new Set(ids));
    } catch (err) {
      console.error('Failed to update the favorites', err);
      this.set(id, !adding);
    }
  }

  // Deleted: the server already took it out of every favorites list
  forget(id: string) {
    this.set(id, false);
  }

  private load() {
    this.http.get<string[]>(this.apiUrl).subscribe({
      next: (ids) => this.idsSignal.set(new Set(ids)),
      error: (err) => console.error('Failed to load the favorites', err),
    });
  }

  private set(id: string, favorite: boolean) {
    const ids = new Set(this.idsSignal());
    if (favorite) ids.add(id);
    else ids.delete(id);
    this.idsSignal.set(ids);
  }
}

// Hearted products
@Injectable({
  providedIn: 'root',
})
export class FavoritesService extends FavoriteIds {
  constructor() {
    super('api/users/me/favorites');
  }
}

// Hearted designs (the designs tab of the favorites page)
@Injectable({
  providedIn: 'root',
})
export class DesignFavoritesService extends FavoriteIds {
  constructor() {
    super('api/users/me/favorite-designs');
  }
}
