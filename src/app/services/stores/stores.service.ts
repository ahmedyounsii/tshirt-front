import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StoreModel } from '../../models/store.model';

// Customization of the logged-in user's store page. Other users' stores come with their
// public profile (UsersService.getCreator)
@Injectable({
  providedIn: 'root',
})
export class StoresService {
  private http = inject(HttpClient);
  private apiUrl = 'api/stores';

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
