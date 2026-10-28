import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UserModel,
} from '../../models/user.model';

const TOKEN_KEY = 'auth-token';
const USER_KEY = 'auth-user';

// The token is kept in localStorage so the session survives a reload. The user is
// cached next to it to render the header right away, then refreshed from the server.
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private apiUrl = 'api/auth';
  private expiryTimer?: ReturnType<typeof setTimeout>;

  private tokenSignal = signal<string | null>(null);
  private userSignal = signal<UserModel | null>(null);
  private readySignal = signal(false);

  readonly token = this.tokenSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.tokenSignal());
  readonly isAdmin = computed(() => this.userSignal()?.role === 'admin');
  readonly isSuperAdmin = computed(() => this.isAdmin() && !!this.userSignal()?.superAdmin);
  // False until the stored session is checked with the server (always false on
  // the server render, which can't read localStorage): show a placeholder meanwhile
  readonly ready = this.readySignal.asReadonly();

  constructor() {
    this.restoreSession();
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, payload)
      .pipe(tap((res) => this.startSession(res)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, payload)
      .pipe(tap((res) => this.startSession(res)));
  }

  // redirectTo: where to go once logged out (e.g. back to the login page after a 401)
  logout(redirectTo: string | null = '/'): void {
    this.clearSession();
    if (redirectTo !== null) {
      this.router.navigateByUrl(redirectTo);
    }
  }

  // After the user edited their account (e.g. their profile picture)
  setUser(user: UserModel): void {
    this.userSignal.set(user);
    this.write(USER_KEY, JSON.stringify(user));
  }

  private startSession({ token, user }: AuthResponse): void {
    this.tokenSignal.set(token);
    this.userSignal.set(user);
    this.write(TOKEN_KEY, token);
    this.write(USER_KEY, JSON.stringify(user));
    this.scheduleExpiry(token);
  }

  private clearSession(): void {
    clearTimeout(this.expiryTimer);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.remove(TOKEN_KEY);
    this.remove(USER_KEY);
  }

  private restoreSession(): void {
    if (!this.isBrowser) return;

    const token = this.read(TOKEN_KEY);
    if (!token || isExpired(token)) {
      this.clearSession();
      this.readySignal.set(true);
      return;
    }

    this.tokenSignal.set(token);
    try {
      this.userSignal.set(JSON.parse(this.read(USER_KEY) ?? 'null'));
    } catch {}
    this.scheduleExpiry(token);

    // Deferred: the request goes through the interceptor, which injects this
    // service, so it can't be sent while the service is still being created
    queueMicrotask(() => this.refreshUser());
  }

  // The cached user may be stale (role changed, account deleted): the
  // interceptor logs out if the server rejects the token
  private refreshUser(): void {
    this.http.get<UserModel>(`${this.apiUrl}/me`).subscribe({
      next: (user) => {
        this.setUser(user);
        this.readySignal.set(true);
      },
      // Rejected token: the interceptor already logged out. Server unreachable:
      // keep the cached user rather than logging out
      error: () => this.readySignal.set(true),
    });
  }

  // Log out when the token expires instead of waiting for a request to fail
  private scheduleExpiry(token: string): void {
    clearTimeout(this.expiryTimer);
    const expiresAt = tokenExpiry(token);
    if (!this.isBrowser || expiresAt === null) return;
    // setTimeout overflows past ~24.8 days: the check on reload covers longer tokens
    const delay = Math.min(expiresAt - Date.now(), 2 ** 31 - 1);
    this.expiryTimer = setTimeout(
      () => this.logout(`/auth?returnUrl=${encodeURIComponent(this.router.url)}`),
      delay,
    );
  }

  private read(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  private remove(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

// Expiry (ms) from the JWT "exp" claim. Only used to schedule the logout:
// the server still verifies the token's signature on every request
function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const expiresAt = tokenExpiry(token);
  return expiresAt === null || expiresAt <= Date.now();
}
