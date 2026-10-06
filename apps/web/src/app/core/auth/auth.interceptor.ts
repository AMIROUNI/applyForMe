import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService, hasSessionMarker } from './auth.service';

const REFRESH_EXCLUDED = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/google/exchange',
];

const RETRY_HEADER = 'X-Auth-Retry';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (!req.url.includes('/api/')) {
    return next(req);
  }

  const canRefresh = !REFRESH_EXCLUDED.some((path) => req.url.includes(path));
  const alreadyRetried = req.headers.has(RETRY_HEADER);

  return next(req.clone({ withCredentials: true })).pipe(
    catchError((err) => {
      const isUnauthorized = err instanceof HttpErrorResponse && err.status === 401;
      // No session marker → there is no refresh cookie to try; fail fast
      // instead of firing a guaranteed-401 /refresh on every page load.
      if (!isUnauthorized || !canRefresh || alreadyRetried || !hasSessionMarker()) {
        return throwError(() => err);
      }

      return auth.refresh().pipe(
        catchError(() => throwError(() => err)),
        // Refresh succeeded: replay the original request with the fresh cookie.
        // The marker header prevents an infinite retry loop on a second 401.
        switchMap(() =>
          next(req.clone({ withCredentials: true, headers: req.headers.set(RETRY_HEADER, '1') })),
        ),
      );
    }),
  );
};
