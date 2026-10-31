import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { StoreModel } from '../../models/store.model';

// Customization of the logged-in user's store page. Other users' stores come with their
// public profile (UsersService.getCreator)
@Injectable({
  providedIn: 'root',
})
export class StoresService {
  private http = inject(HttpClient);
  private apiUrl = 'api/stores';

  // Address of the logged in user's open store (/store/<slug>), once a request told it: lets
  // ownStoreMatch know their store page by it. Tied to the user it was read for
  private readonly mine = signal<{ userId: string; slug: string } | null>(null);

  // The slug of that user's open store, if known
  mySlug(userId: string): string | null {
    const mine = this.mine();
    return mine?.userId === userId ? mine.slug : null;
  }

  // Keeps the address of the user's store while it is open, forgets it otherwise
  remember(userId: string, store: StoreModel) {
    this.mine.set(store.slug && store.status === 'active' ? { userId, slug: store.slug } : null);
  }

  getMine(): Observable<StoreModel> {
    return this.http.get<StoreModel>(`${this.apiUrl}/me`);
  }

  // A banner made by prepareBanner. Both respond with the updated store
  uploadBanner(file: Blob): Observable<StoreModel> {
    const form = new FormData();
    form.append('banner', file, file.type === 'image/webp' ? 'banner.webp' : 'banner.jpg');
    return this.http.put<StoreModel>(`${this.apiUrl}/me/banner`, form);
  }

  // Back to the default banner
  removeBanner(): Observable<StoreModel> {
    return this.http.delete<StoreModel>(`${this.apiUrl}/me/banner`);
  }
}
