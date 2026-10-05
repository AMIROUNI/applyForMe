import { Injectable, isDevMode } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent
} from '@angular/common/http';
import { Observable, delay, timer, switchMap } from 'rxjs';

export const devDelayInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  if (!isDevMode()) {
    return next(req);
  }

  if (req.url.includes('/api/v1/me') || req.url.includes('/api/v1/auth/me')) {
    return timer(3000).pipe(
      delay(0),
      switchMap(() => next(req))
    );
  }

  return next(req);
};