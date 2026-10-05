import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, throwError, tap } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export type SessionState = 'unknown' | 'authenticated' | 'anonymous';

const API = '/api/v1';

/**
 * The API sets a non-httpOnly `af_sid` flag cookie whenever a session exists.
 * It carries no token — it only tells the client a silent refresh is worth
 * attempting, so logged-out visitors never fire 401s at /me + /refresh.
 */
export function hasSessionMarker(): boolean {
  return typeof document !== 'undefined' && /(?:^|;\s*)af_sid=/.test(document.cookie);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);

  readonly user = signal<AuthUser | null>(null);
  readonly sessionState = signal<SessionState>('unknown');
  readonly initialized = signal(false);
  readonly loggedIn = computed(() => this.sessionState() === 'authenticated');

  private refreshInFlight: Observable<AuthResponse> | null = null;

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API}/auth/register`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  exchangeGoogleCode(code: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API}/auth/google/exchange`, { code })
      .pipe(tap((res) => this.setSession(res)));
  }

  logout(): Observable<void> {
    return this.http.post<{ success: boolean }>(`${API}/auth/logout`, {}).pipe(
      map(() => undefined),
      tap(() => this.clearSession()),
      // The endpoint may be unreachable; never leave the UI signed in.
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
    );
  }

  refresh(): Observable<AuthResponse> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http.post<AuthResponse>(`${API}/auth/refresh`, {}).pipe(
        tap((res) => this.setSession(res)),
        catchError((err) => {
          this.clearSession();
          return throwError(() => err);
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshInFlight;
  }

  checkSession(): void {
    if (this.initialized()) {
      return;
    }
    if (!hasSessionMarker()) {
      this.clearSession();
      return;
    }
    this.http.get<AuthUser>(`${API}/auth/me`).subscribe({
      next: (user) => {
        // Ignore stale responses that land after a login/register/logout.
        if (this.sessionState() !== 'unknown') {
          return;
        }
        this.user.set(user);
        this.sessionState.set('authenticated');
        this.initialized.set(true);
      },
      error: () => {
        if (this.sessionState() !== 'unknown') {
          return;
        }
        this.clearSession();
      },
      complete: () => {
        this.initialized.set(true);
      },
    });
  }

  googleLogin(): void {
    window.location.assign(`${API}/auth/google`);
  }

  errorMessage(err: unknown, fallback: string): string {
    const body = (err as HttpErrorResponse)?.error;
    const code = typeof body?.code === 'string' ? body.code : '';
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return this.translate('auth.error.invalidCredentials');
      case 'EMAIL_TAKEN':
      case 'USER_EXISTS':
        return this.translate('auth.error.emailTaken');
      case 'RATE_LIMITED':
        return this.translate('auth.error.rateLimited');
      case 'VALIDATION_ERROR':
        return typeof body?.message === 'string' ? body.message : fallback;
      default:
        return typeof body?.message === 'string' && body.message.length < 200 ? body.message : fallback;
    }
  }

  private setSession(res: AuthResponse): void {
    this.user.set(res.user);
    this.sessionState.set('authenticated');
    this.initialized.set(true);
  }

  private clearSession(): void {
    this.user.set(null);
    this.sessionState.set('anonymous');
    this.initialized.set(true);
  }

  private translate(key: string): string {
    return this.i18n.t()[key] ?? key;
  }
}
