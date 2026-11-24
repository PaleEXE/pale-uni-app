import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Allows access to registered users and active guest sessions.
 * Redirects unauthenticated or expired sessions to /login.
 */
export const sessionGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasActiveSession()) {
    return true;
  }

  const expired = authService.consumeExpiredFlag();
  return router.createUrlTree(['/login'], {
    queryParams: {
      ...(expired ? { expired: 'true' } : {}),
      returnUrl: state.url,
    },
  });
};
