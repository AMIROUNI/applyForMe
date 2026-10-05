import { Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { take } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/layout/theme.service';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_PAGE_STYLES } from './auth.styles';

@Component({
  selector: 'app-auth-callback-page',
  standalone: true,
  imports: [],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <a href="/" class="auth-card__logo" aria-label="ApplyForME home">
          <img [src]="logoSrc()" alt="" class="auth-card__logo-img" width="160" height="40">
        </a>

        <div class="auth-status">
          <div class="auth-status__spinner" role="status" aria-live="polite"></div>
          <p class="auth-card__subtitle">{{ t()['auth.callback.title'] }}</p>
          @if (failed()) {
            <div class="auth-alert" role="alert">{{ t()['auth.error.oauthFailed'] }}</div>
          }
        </div>
      </section>
    </main>
  `,
  styles: [AUTH_PAGE_STYLES],
})
export class AuthCallbackPageComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private theme = inject(ThemeService);

  t = computed(() => this.i18n.t());
  failed = signal(false);

  logoSrc = computed(() =>
    this.theme.effectiveTheme() === 'dark'
      ? '/assets/brand/logo-full-dark.svg'
      : '/assets/brand/logo-full.svg',
  );

  constructor() {
    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const code = params.get('code');
      if (!code) {
        this.fail();
        return;
      }
      this.auth.exchangeGoogleCode(code).subscribe({
        next: () => this.router.navigateByUrl('/', { replaceUrl: true }),
        error: () => this.fail(),
      });
    });
  }

  private fail(): void {
    this.failed.set(true);
    setTimeout(() => {
      this.router.navigate(['/login'], { queryParams: { error: 'oauth_failed' }, replaceUrl: true });
    }, 1500);
  }
}
