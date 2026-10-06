import { isDevMode } from '@angular/core';
import type {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import type { Observable } from 'rxjs';
import { delay, timer, switchMap } from 'rxjs';

export const devDelayInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (!isDevMode()) {
    return next(req);
  }

  if (req.url.includes('/api/v1/me') || req.url.includes('/api/v1/auth/me')) {
    return timer(3000).pipe(
      delay(0),
      switchMap(() => next(req)),
    );
  }

  return next(req);
};
