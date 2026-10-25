import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatorProfile } from '../../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private http = inject(HttpClient);
  private apiUrl = 'api/users';

  // Public profile of a creator, by username (or id for accounts made before usernames)
  getCreator(handle: string): Observable<CreatorProfile> {
    return this.http.get<CreatorProfile>(
      `${this.apiUrl}/${encodeURIComponent(handle)}/public`,
    );
  }
}
