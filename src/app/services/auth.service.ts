import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface User {
  user_id: number;
  username: string;
  email: string;
  preferred_theme: string;
  phone_number?: string;
  created_at: string;
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
  user_id: number;
  username: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/api';
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;
  private tokenSubject: BehaviorSubject<string | null>;
  public token$: Observable<string | null>;

  constructor() {
    const initialUser = this.isBrowser ? this.getUserFromStorage() : null;
    const initialToken = this.isBrowser ? this.getTokenFromStorage() : null;

    this.currentUserSubject = new BehaviorSubject<User | null>(initialUser);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.tokenSubject = new BehaviorSubject<string | null>(initialToken);
    this.token$ = this.tokenSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get currentToken(): string | null {
    return this.tokenSubject.value;
  }

  login(loginRequest: LoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/login`, loginRequest)
      .pipe(
        map((response) => {
          const user: User = {
            user_id: response.user_id,
            username: response.username,
            email: response.email,
            preferred_theme: 'light',
            created_at: new Date().toISOString(),
          };
          this.storeToken(response.access_token);
          this.storeUser(user);
          this.tokenSubject.next(response.access_token);
          this.currentUserSubject.next(user);
          return response;
        })
      );
  }

  register(registerRequest: RegisterRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/register`, registerRequest)
      .pipe(
        map((response) => {
          const user: User = {
            user_id: response.user_id,
            username: response.username,
            email: response.email,
            preferred_theme: registerRequest.preferred_theme || 'light',
            phone_number: registerRequest.phone_number,
            created_at: new Date().toISOString(),
          };
          this.storeToken(response.access_token);
          this.storeUser(user);
          this.tokenSubject.next(response.access_token);
          this.currentUserSubject.next(user);
          return response;
        })
      );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
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

  isLoggedIn(): boolean {
    return this.getTokenFromStorage() !== null;
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
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  }
}
