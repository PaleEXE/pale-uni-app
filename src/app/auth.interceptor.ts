// src/app/interceptors/auth.interceptor.ts

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service'; // Adjust path as needed

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Use inject() to get the AuthService instance, even outside the constructor
  const authService = inject(AuthService);
  const authToken = authService.currentToken; // Get the current token value

  // Check if a token exists and if the request is for your API
  if (authToken) {
    // HttpRequest objects are immutable, so you must clone it to modify it.
    const clonedRequest = req.clone({
      setHeaders: {
        // Set the Authorization header with the Bearer token format
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Pass the cloned request to the next handler
    return next(clonedRequest);
  }

  // If no token exists, or no modification is needed, pass the original request
  return next(req);
};
