import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

export type SessionMode = 'authenticated' | 'guest' | 'none';

export interface User {
  user_id: number;
  username: string;
  email: string;
  preferred_theme: string;
  phone_number?: string;
  created_at: string;
}

export interface GuestSession {
  guest_id: string;
  access_token: string;
  expires_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  phone_number?: string;
  preferred_theme?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role?: string;
  user_id: number;
  username: string;
  email: string;
  expires_at?: string;
}

export interface GuestTokenResponse {
  access_token: string;
  token_type: string;
  role: 'guest';
  guest_id: string;
  expires_at: string;
}

const GUEST_SESSION_KEY = 'guest_session';
const GUEST_WORKSPACE_KEYS = [
  'graph_builder_state',
  'logic-expression',
  'logic-headers',
  'logic-data',
  'fp-tree-width',
  'fp-tree-height',
  'fp-tree-transactions',
  'clustering_algorithm',
  'clustering_k',
  'clustering_eps',
  'clustering_minSamples',
  'clustering_points',
  'clustering_labels',
  'clustering_centroids',
];

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api`;
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  private tokenSubject: BehaviorSubject<string | null>;
  public token$: Observable<string | null>;

  private guestSessionSubject: BehaviorSubject<GuestSession | null>;
  public guestSession$: Observable<GuestSession | null>;

  private sessionModeSubject: BehaviorSubject<SessionMode>;
  public sessionMode$: Observable<SessionMode>;

  public isGuest$: Observable<boolean>;

  /** Tracks whether a guest/user session expired during the last check */
  private _sessionExpired = false;

  constructor() {
    let initialUser: User | null = null;
    let initialToken: string | null = null;
    let initialGuest: GuestSession | null = null;
    let initialMode: SessionMode = 'none';

    if (this.isBrowser) {
      const storedToken = this.getTokenFromStorage();
      const storedUser = this.getUserFromStorage();
      const storedGuest = this.getGuestFromStorage();

      if (storedUser && storedToken && !this.isJwtExpired(storedToken)) {
        initialUser = storedUser;
        initialToken = storedToken;
        initialMode = 'authenticated';
      } else if (
        storedGuest &&
        !this.isTimestampExpired(storedGuest.expires_at) &&
        !this.isJwtExpired(storedGuest.access_token)
      ) {
        initialGuest = storedGuest;
        initialToken = storedGuest.access_token;
        initialMode = 'guest';
      } else {
        // Clean up any stale or expired session keys
        if (storedGuest || storedToken || storedUser) {
          this._sessionExpired = true;
          this.clearAllSessionStorage();
          if (storedGuest) {
            this.clearGuestTemporaryData();
          }
        }
      }
    }

    this.currentUserSubject = new BehaviorSubject<User | null>(initialUser);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.tokenSubject = new BehaviorSubject<string | null>(initialToken);
    this.token$ = this.tokenSubject.asObservable();

    this.guestSessionSubject = new BehaviorSubject<GuestSession | null>(
      initialGuest
    );
    this.guestSession$ = this.guestSessionSubject.asObservable();

    this.sessionModeSubject = new BehaviorSubject<SessionMode>(initialMode);
    this.sessionMode$ = this.sessionModeSubject.asObservable();
    this.isGuest$ = this.sessionMode$.pipe(map((mode) => mode === 'guest'));
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get currentToken(): string | null {
    if (this.isGuest()) {
      return this.guestSessionSubject.value?.access_token ?? null;
    }
    if (this.isLoggedIn()) {
      return this.tokenSubject.value;
    }
    return null;
  }

  public get currentSessionMode(): SessionMode {
    return this.sessionModeSubject.value;
  }

  public get currentGuestSession(): GuestSession | null {
    return this.guestSessionSubject.value;
  }

  public consumeExpiredFlag(): boolean {
    const expired = this._sessionExpired;
    this._sessionExpired = false;
    return expired;
  }

  /** Start a genuine stateless guest session backed by a short-lived JWT */
  continueAsGuest(): Observable<GuestTokenResponse> {
    return this.http
      .post<GuestTokenResponse>(`${this.apiUrl}/auth/guest`, {})
      .pipe(
        map((response) => {
          const guestSession: GuestSession = {
            guest_id: response.guest_id,
            access_token: response.access_token,
            expires_at: response.expires_at,
          };
          this.clearAllSessionStorage();
          this.storeToken(response.access_token);
          this.storeGuest(guestSession);

          this._sessionExpired = false;
          this.currentUserSubject.next(null);
          this.guestSessionSubject.next(guestSession);
          this.tokenSubject.next(response.access_token);
          this.sessionModeSubject.next('guest');
          return response;
        })
      );
  }

  login(loginRequest: LoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/login`, loginRequest)
      .pipe(
        map((response) => {
          const wasGuest = this.sessionModeSubject.value === 'guest';
          const user: User = {
            user_id: response.user_id,
            username: response.username,
            email: response.email,
            preferred_theme: 'light',
            created_at: new Date().toISOString(),
          };

          // Isolate temporary guest workspace data so it never associates with a user account
          if (wasGuest) {
            this.clearGuestTemporaryData();
          }

          this.removeGuestFromStorage();
          this.storeToken(response.access_token);
          this.storeUser(user);

          this._sessionExpired = false;
          this.guestSessionSubject.next(null);
          this.tokenSubject.next(response.access_token);
          this.currentUserSubject.next(user);
          this.sessionModeSubject.next('authenticated');
          return response;
        })
      );
  }

  register(registerRequest: RegisterRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/register`, registerRequest)
      .pipe(
        map((response) => {
          const wasGuest = this.sessionModeSubject.value === 'guest';
          const user: User = {
            user_id: response.user_id,
            username: response.username,
            email: response.email,
            preferred_theme: registerRequest.preferred_theme || 'light',
            phone_number: registerRequest.phone_number,
            created_at: new Date().toISOString(),
          };

          // Isolate temporary guest workspace data when converting to a registered account
          if (wasGuest) {
            this.clearGuestTemporaryData();
          }

          this.removeGuestFromStorage();
          this.storeToken(response.access_token);
          this.storeUser(user);

          this._sessionExpired = false;
          this.guestSessionSubject.next(null);
          this.tokenSubject.next(response.access_token);
          this.currentUserSubject.next(user);
          this.sessionModeSubject.next('authenticated');
          return response;
        })
      );
  }

  logout(): void {
    const wasGuest = this.sessionModeSubject.value === 'guest';
    this.clearAllSessionStorage();
    if (wasGuest) {
      this.clearGuestTemporaryData();
    }
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    this.guestSessionSubject.next(null);
    this.sessionModeSubject.next('none');
  }

  handleSessionExpired(): void {
    this._sessionExpired = true;
    this.logout();
  }

  changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Observable<any> {
    const request = {
      current_password: currentPassword,
      new_password: newPassword,
    };
    return this.http.post(
      `${this.apiUrl}/auth/change-password?user_id=${userId}`,
      request
    );
  }

  /** True only for a registered, non-expired authenticated user */
  isLoggedIn(): boolean {
    if (!this.isBrowser) return false;
    const token = this.getTokenFromStorage();
    const user = this.getUserFromStorage();
    if (!token || !user) return false;
    if (this.isJwtExpired(token)) {
      this.handleSessionExpired();
      return false;
    }
    return true;
  }

  /** True only for an active, non-expired guest session */
  isGuest(): boolean {
    if (!this.isBrowser) return false;
    const guest = this.getGuestFromStorage();
    if (!guest) return false;
    if (
      this.isTimestampExpired(guest.expires_at) ||
      this.isJwtExpired(guest.access_token)
    ) {
      this.handleSessionExpired();
      return false;
    }
    return true;
  }

  /** True when user is either authenticated OR browsing in an active guest session */
  hasActiveSession(): boolean {
    return this.isLoggedIn() || this.isGuest();
  }

  /** Remove ephemeral client-side workspace keys created during a guest session */
  clearGuestTemporaryData(): void {
    if (!this.isBrowser) return;
    for (const key of GUEST_WORKSPACE_KEYS) {
      localStorage.removeItem(key);
    }
  }

  // ─── Storage & Expiration Helpers ────────────────────────────────

  private clearAllSessionStorage(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(GUEST_SESSION_KEY);
  }

  private storeToken(token: string): void {
    if (this.isBrowser) {
      localStorage.setItem('token', token);
    }
  }

  private getTokenFromStorage(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem('token');
    }
    return null;
  }

  private storeUser(user: User): void {
    if (this.isBrowser) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  private getUserFromStorage(): User | null {
    if (this.isBrowser) {
      try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private storeGuest(guest: GuestSession): void {
    if (this.isBrowser) {
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guest));
    }
  }

  private getGuestFromStorage(): GuestSession | null {
    if (this.isBrowser) {
      try {
        const raw = localStorage.getItem(GUEST_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private removeGuestFromStorage(): void {
    if (this.isBrowser) {
      localStorage.removeItem(GUEST_SESSION_KEY);
    }
  }

  private isTimestampExpired(isoTimestamp: string): boolean {
    const expMs = Date.parse(isoTimestamp);
    if (Number.isNaN(expMs)) return true;
    return Date.now() >= expMs;
  }

  private isJwtExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      if (typeof payload.exp !== 'number') return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }
}
