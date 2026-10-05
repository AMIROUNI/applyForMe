import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/layout/theme.service';
import { AuthService } from '../../core/auth/auth.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { AUTH_PAGE_STYLES } from './auth.styles';

const MIN_PASSWORD_LENGTH = 10;

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ButtonComponent],
  template: `
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="register-title">
        <a href="/" class="auth-card__logo" aria-label="ApplyForME home">
          <img [src]="logoSrc()" alt="" class="auth-card__logo-img" width="160" height="40">
        </a>

        <h1 id="register-title" class="auth-card__title">{{ t()['auth.register.title'] }}</h1>
        <p class="auth-card__subtitle">{{ t()['auth.register.subtitle'] }}</p>

        @if (error()) {
          <div class="auth-alert" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="auth-field">
            <label class="auth-field__label" for="register-email">{{ t()['auth.email'] }}</label>
            <input
              id="register-email"
              class="auth-field__input"
              type="email"
              formControlName="email"
              autocomplete="email"
              inputmode="email"
              placeholder="you@example.com"
              [attr.aria-invalid]="showError('email') ? 'true' : null"
            >
            @if (showError('email')) {
              <span class="auth-field__error">{{ t()['auth.error.invalidEmail'] }}</span>
            }
          </div>

          <div class="auth-field">
            <label class="auth-field__label" for="register-password">{{ t()['auth.password'] }}</label>
            <input
              id="register-password"
              class="auth-field__input"
              type="password"
              formControlName="password"
              autocomplete="new-password"
              placeholder="••••••••"
              [attr.aria-invalid]="showError('password') ? 'true' : null"
            >
            @if (showError('password')) {
              <span class="auth-field__error">{{ t()['auth.error.passwordTooShort'] }}</span>
            }
          </div>

          <div class="auth-field">
            <label class="auth-field__label" for="register-confirm">{{ t()['auth.confirmPassword'] }}</label>
            <input
              id="register-confirm"
              class="auth-field__input"
              type="password"
              formControlName="confirm"
              autocomplete="new-password"
              placeholder="••••••••"
              [attr.aria-invalid]="showError('confirm') ? 'true' : null"
            >
            @if (showError('confirm')) {
              <span class="auth-field__error">{{ t()['auth.error.passwordMismatch'] }}</span>
            }
          </div>

          <app-button type="submit" variant="primary" [gradient]="true" class="auth-submit" [loading]="loading()">
            {{ t()['auth.submitRegister'] }}
          </app-button>
        </form>

        <div class="auth-divider">{{ t()['auth.or'] }}</div>

        <button type="button" class="auth-google" (click)="googleSignIn()" [disabled]="loading()">
          <svg class="auth-google__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.5z"/>
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-7-5.1L1.1 17C3.1 21.2 7.2 24 12 24z"/>
            <path fill="#FBBC05" d="M5 14.3c-.3-.8-.4-1.7-.4-2.6s.1-1.8.4-2.6L1.1 6.2C.4 7.8 0 9.6 0 11.7s.4 3.9 1.1 5.5l3.9-2.9z"/>
            <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17 1.2 14.8 0 12 0 7.2 0 3.1 2.8 1.1 6.2l3.9 2.9c1-3 3.8-4.4 7-4.4z"/>
          </svg>
          {{ t()['auth.google'] }}
        </button>

        <p class="auth-switch">
          {{ t()['auth.haveAccount'] }}
          <a routerLink="/login">{{ t()['auth.logInInstead'] }}</a>
        </p>
      </section>
    </main>
  `,
  styles: [AUTH_PAGE_STYLES],
})
export class RegisterPageComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
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

  form: FormGroup = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirm: ['', [Validators.required]],
    },
    { validators: [this.passwordsMatch] },
  );

  showError(control: 'email' | 'password' | 'confirm'): boolean {
    if (!this.submitted()) return false;
    if (control === 'confirm') {
      return !!this.form.errors?.['mismatch'] || this.form.controls['confirm'].invalid;
    }
    return this.form.controls[control].invalid;
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      const controls = this.form.controls;
      if (controls['email'].invalid) {
        this.error.set(this.t()['auth.error.invalidEmail']);
      } else if (controls['password'].invalid) {
        this.error.set(this.t()['auth.error.passwordTooShort']);
      } else {
        this.error.set(this.t()['auth.error.passwordMismatch']);
      }
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.register(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/', { replaceUrl: true });
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

  private passwordsMatch(group: AbstractControl): { mismatch: boolean } | null {
    const password = group.get('password')?.value;
    const confirm = group.get('confirm')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  }
}
