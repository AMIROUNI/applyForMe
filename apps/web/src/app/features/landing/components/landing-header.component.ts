import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeToggleComponent } from '../../../core/layout/theme-toggle.component';
import { LanguageToggleComponent } from '../../../core/i18n/language-toggle.component';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ThemeService } from '../../../core/layout/theme.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

@Component({
  selector: 'app-landing-header',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, LanguageToggleComponent, ButtonComponent],
  template: `
    <header class="landing-header">
      <div class="landing-header__container">
        <a href="/" class="landing-header__logo" aria-label="ApplyForME home">
          <img
            [src]="logoSrc()"
            alt=""
            class="landing-header__logo-img"
            width="180"
            height="45"
            loading="eager"
            decoding="async"
          >
        </a>

        <nav class="landing-header__nav" aria-label="Main navigation">
          <app-theme-toggle></app-theme-toggle>
          <app-language-toggle></app-language-toggle>
          <div class="landing-header__actions">
            @if (auth.loggedIn()) {
              <span class="landing-header__user" [title]="auth.user()?.email ?? ''">
                {{ auth.user()?.email }}
              </span>
              <app-button variant="ghost" (clicked)="onLogOutClick()">{{ t()['header.logOut'] }}</app-button>
            } @else {
              <app-button variant="ghost" (clicked)="onLogInClick()">{{ t()['header.logIn'] }}</app-button>
              <app-button variant="primary" [gradient]="true" (clicked)="onGetStartedClick()">{{ t()['header.getStarted'] }}</app-button>
            }
          </div>
        </nav>
      </div>
    </header>
  `,
  styles: [`
    .landing-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
      padding: var(--spacing-3) 0;
      transition: background-color var(--transition-duration) var(--transition-ease), border-color var(--transition-duration) var(--transition-ease);
    }

    .landing-header__container {
      max-width: var(--max-content-width);
      margin: 0 auto;
      padding: 0 var(--spacing-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-4);
    }

    .landing-header__logo {
      flex-shrink: 0;
      text-decoration: none;
    }

    .landing-header__logo-img {
      height: 36px;
      width: auto;
    }

    .landing-header__nav {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
    }

    .landing-header__actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .landing-header__user {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      padding: 0 var(--spacing-2);
    }

    @media (max-width: 768px) {
      .landing-header__nav {
        gap: var(--spacing-2);
      }

      .landing-header__logo-img {
        height: 32px;
      }
    }

    @media (max-width: 480px) {
      .landing-header {
        padding: var(--spacing-2) 0;
      }
    }
  `]
})
export class LandingHeaderComponent {
  private i18n = inject(I18nService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  auth = inject(AuthService);

  t = computed(() => this.i18n.t());
  isDark = computed(() => this.themeService.effectiveTheme() === 'dark');

  logoSrc = computed(() => {
    return this.isDark()
      ? '/assets/brand/logo-full-dark.svg'
      : '/assets/brand/logo-full.svg';
  });

  onLogInClick(): void {
    this.router.navigate(['/login']);
  }

  onGetStartedClick(): void {
    this.router.navigate(['/register']);
  }

  onLogOutClick(): void {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/'], { replaceUrl: true });
    });
  }
}