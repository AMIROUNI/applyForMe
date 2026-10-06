import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Blocks authenticated routes until the session check resolves.
 * Anonymous visitors are redirected to /login with a returnUrl.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  auth.checkSession();

  const loginTree = router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });

  if (auth.loggedIn()) {
    return true;
  }

  if (auth.initialized()) {
    return loginTree;
  }

  return toObservable(auth.initialized).pipe(
    filter((initialized) => initialized),
    take(1),
    map(() => (auth.loggedIn() ? true : loginTree)),
  );
};
