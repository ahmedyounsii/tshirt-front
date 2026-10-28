import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  ChangePasswordPayload,
  CreatorProfile,
  UniqueUserField,
  UpdateAccountPayload,
  UserModel,
  UserRole,
} from '../../models/user.model';

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

  // avatar: the path of a ready-made picture (USER_PICS). All three respond with the updated user
  updateAvatar(avatar: string): Observable<UserModel> {
    return this.http.put<UserModel>(`${this.apiUrl}/me/avatar`, { avatar });
  }

  // A photo made by prepareAvatar, saved as a file on the server
  uploadAvatar(file: Blob): Observable<UserModel> {
    const form = new FormData();
    form.append('avatar', file, file.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg');
    return this.http.put<UserModel>(`${this.apiUrl}/me/avatar`, form);
  }

  removeAvatar(): Observable<UserModel> {
    return this.http.delete<UserModel>(`${this.apiUrl}/me/avatar`);
  }

  // Account settings of the logged-in user: name, username and email
  updateAccount(payload: UpdateAccountPayload): Observable<UserModel> {
    return this.http.put<UserModel>(`${this.apiUrl}/me`, payload);
  }

  // Whether no other account uses this username or email (the user's own counts as free)
  isAvailable(field: UniqueUserField, value: string): Observable<boolean> {
    return this.http
      .get<{ available: boolean }>(`${this.apiUrl}/availability`, {
        params: { [field]: value },
      })
      .pipe(map((res) => res.available));
  }

  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/me/password`, payload);
  }

  // Admin only: users whose name, username or email contains "search" (any of them when
  // empty), of one role or both. Admins first, at most 20
  searchUsers(search: string, role?: UserRole): Observable<UserModel[]> {
    const params: Record<string, string> = {};
    if (search) params['q'] = search;
    if (role) params['role'] = role;
    return this.http.get<UserModel[]>(this.apiUrl, { params });
  }

  // Admin only: makes a user an admin or a regular user again, responds with the user
  setRole(id: string, role: UserRole): Observable<UserModel> {
    return this.http.put<UserModel>(`${this.apiUrl}/${id}/role`, { role });
  }
}
