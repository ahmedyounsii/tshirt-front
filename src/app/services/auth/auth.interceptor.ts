import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// Only our own API gets the token, never third party URLs
const isApiRequest = (url: string) => /^\/?api\//.test(url);
// A 401 on these means wrong credentials, not an expired session
const isAuthRequest = (url: string) => /^\/?api\/auth\/(login|register)/.test(url);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Token rejected (expired, user deleted...): drop the session and ask to log in again
      if (error.status === 401 && token && !isAuthRequest(req.url)) {
        auth.logout(`/auth?returnUrl=${encodeURIComponent(router.url)}`);
      }
      return throwError(() => error);
    }),
  );
};
