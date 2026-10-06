import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FormGroup } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { take } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/layout/theme.service';
import { AuthService } from '../../core/auth/auth.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { AUTH_PAGE_STYLES } from './auth.styles';

const OAUTH_ERRORS: Record<string, string> = {
  invalid_state: 'auth.error.invalidState',
  oauth_failed: 'auth.error.oauthFailed',
  access_denied: 'auth.error.accessDenied',
  email_not_verified: 'auth.error.emailNotVerified',
};

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ButtonComponent],
  template: `
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="login-title">
        <a href="/" class="auth-card__logo" aria-label="ApplyForME home">
          <img [src]="logoSrc()" alt="" class="auth-card__logo-img" width="160" height="40" />
        </a>

        <h1 id="login-title" class="auth-card__title">{{ t()['auth.login.title'] }}</h1>
        <p class="auth-card__subtitle">{{ t()['auth.login.subtitle'] }}</p>

        @if (error()) {
          <div class="auth-alert" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="auth-field">
            <label class="auth-field__label" for="login-email">{{ t()['auth.email'] }}</label>
            <input
              id="login-email"
              class="auth-field__input"
              type="email"
              formControlName="email"
              autocomplete="email"
              inputmode="email"
              placeholder="you@example.com"
              [attr.aria-invalid]="showError('email') ? 'true' : null"
            />
            @if (showError('email')) {
              <span class="auth-field__error">{{ t()['auth.error.invalidEmail'] }}</span>
            }
          </div>

          <div class="auth-field">
            <label class="auth-field__label" for="login-password">{{ t()['auth.password'] }}</label>
            <input
              id="login-password"
              class="auth-field__input"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="••••••••"
              [attr.aria-invalid]="showError('password') ? 'true' : null"
            />
            @if (showError('password')) {
              <span class="auth-field__error">{{ t()['auth.error.required'] }}</span>
            }
          </div>

          <app-button
            type="submit"
            variant="primary"
            [gradient]="true"
            class="auth-submit"
            [loading]="loading()"
          >
            {{ t()['auth.submitLogin'] }}
          </app-button>
        </form>

        <div class="auth-divider">{{ t()['auth.or'] }}</div>

        <button type="button" class="auth-google" (click)="googleSignIn()" [disabled]="loading()">
          <svg class="auth-google__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.5z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-7-5.1L1.1 17C3.1 21.2 7.2 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5 14.3c-.3-.8-.4-1.7-.4-2.6s.1-1.8.4-2.6L1.1 6.2C.4 7.8 0 9.6 0 11.7s.4 3.9 1.1 5.5l3.9-2.9z"
            />
            <path
              fill="#EA4335"
              d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17 1.2 14.8 0 12 0 7.2 0 3.1 2.8 1.1 6.2l3.9 2.9c1-3 3.8-4.4 7-4.4z"
            />
          </svg>
          {{ t()['auth.google'] }}
        </button>

        <p class="auth-switch">
          {{ t()['auth.noAccount'] }}
          <a routerLink="/register">{{ t()['auth.createAccount'] }}</a>
        </p>
      </section>
    </main>
  `,
  styles: [AUTH_PAGE_STYLES],
})
export class LoginPageComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private theme = inject(ThemeService);

  t = computed(() => this.i18n.t());
  loading = signal(false);
  error = signal<string | null>(null);
  submitted = signal(false);

  logoSrc = computed(() =>
    this.theme.effectiveTheme() === 'dark'
      ? '/assets/brand/logo-full-dark.svg'
      : '/assets/brand/logo-full.svg',
  );

  form: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const err = params.get('error');
      if (err && OAUTH_ERRORS[err]) {
        this.error.set(this.t()[OAUTH_ERRORS[err]]);
      }
      if (params.get('registered') === '1') {
        this.error.set(null);
      }
    });
  }

  showError(control: 'email' | 'password'): boolean {
    if (!this.submitted()) return false;
    const c = this.form.controls[control];
    return c.invalid;
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.error.set(
        this.form.controls['email'].invalid
          ? this.t()['auth.error.invalidEmail']
          : this.t()['auth.error.required'],
      );
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl || '/dashboard', { replaceUrl: true });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.auth.errorMessage(err, this.t()['auth.error.generic']));
      },
    });
  }

  googleSignIn(): void {
    this.error.set(null);
    this.auth.googleLogin();
  }
}
