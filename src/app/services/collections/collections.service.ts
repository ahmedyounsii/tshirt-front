import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { CollectionModel, CollectionPayload } from '../../models/collection.model';
import { environment } from '../../../environments/environment';
import { DiscountsService } from '../discounts/discounts.service';

// The wallpaper to send with a save: a new file, or "remove" to drop the current one
export type WallpaperChange = File | 'remove' | null;

@Injectable({
  providedIn: 'root',
})
export class CollectionsService {
  private http = inject(HttpClient);
  private discounts = inject(DiscountsService);
  private apiUrl = 'api/collections';
  private baseUrl = environment.baseUrl;

  // The published collections, newest first. With the drafts: "mine" for the
  // ones of the logged in user, "all" for every collection (admins)
  getCollections(scope: 'published' | 'mine' | 'all' = 'published'): Observable<CollectionModel[]> {
    const params: Record<string, string> = scope === 'published' ? {} : { [scope]: 'true' };
    return this.http
      .get<CollectionModel[]>(this.apiUrl, { params })
      .pipe(map((list) => list.map((c) => this.withUrls(c))));
  }

  // The published collections made by a user, newest first (their public profile)
  getCreatorCollections(creatorId: string): Observable<CollectionModel[]> {
    return this.http
      .get<CollectionModel[]>(this.apiUrl, { params: { creator: creatorId } })
      .pipe(map((list) => list.map((c) => this.withUrls(c))));
  }

  // The one shown on the home page, null when none is
  getFeatured(): Observable<CollectionModel | null> {
    return this.http
      .get<CollectionModel[]>(this.apiUrl, { params: { featured: 'true' } })
      .pipe(map((list) => (list[0] ? this.withUrls(list[0]) : null)));
  }

  // By its slug (landing page) or its id (admin editor)
  getCollection(key: string): Observable<CollectionModel> {
    return this.http
      .get<CollectionModel>(`${this.apiUrl}/${encodeURIComponent(key)}`)
      .pipe(map((c) => this.withUrls(c)));
  }

  // Any logged in user: only admins can put it on the home page
  createCollection(payload: CollectionPayload, wallpaper: WallpaperChange): Observable<CollectionModel> {
    return this.http
      .post<CollectionModel>(this.apiUrl, this.toFormData(payload, wallpaper))
      .pipe(map((c) => this.withUrls(c)));
  }

  // Its maker or an admin
  updateCollection(
    id: string,
    payload: CollectionPayload,
    wallpaper: WallpaperChange,
  ): Observable<CollectionModel> {
    return this.http
      .put<CollectionModel>(`${this.apiUrl}/${id}`, this.toFormData(payload, wallpaper))
      .pipe(
        // Its discount follows the products it now holds
        tap(() => this.discounts.reload()),
        map((c) => this.withUrls(c)),
      );
  }

  // Its maker or an admin: the products stay in the store, without its discount
  deleteCollection(id: string): Observable<{ message: string }> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(tap(() => this.discounts.reload()));
  }

  private toFormData(payload: CollectionPayload, wallpaper: WallpaperChange): FormData {
    const formData = new FormData();
    formData.append('data', JSON.stringify(payload));
    if (wallpaper instanceof File) formData.append('wallpaper', wallpaper);
    else if (wallpaper === 'remove') formData.append('removeWallpaper', 'true');
    return formData;
  }

  // Server paths (/uploads/...) to urls the browser can load
  private withUrls(collection: CollectionModel): CollectionModel {
    return {
      ...collection,
      wallpaper: collection.wallpaper ? `${this.baseUrl}${collection.wallpaper}` : undefined,
      products: collection.products.map((p) => ({
        ...p,
        url: `${this.baseUrl}${p.url}`,
        backUrl: p.backUrl ? `${this.baseUrl}${p.backUrl}` : undefined,
      })),
    };
  }
}
