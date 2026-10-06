import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeToggleComponent } from './theme-toggle.component';
import { LanguageToggleComponent } from '../i18n/language-toggle.component';
import { I18nService } from '../i18n/i18n.service';
import { ThemeService } from './theme.service';
import { AuthService } from '../auth/auth.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    LanguageToggleComponent,
    ButtonComponent,
  ],
  template: `
    <header class="app-header">
      <div class="app-header__container">
        <a href="/" class="app-header__logo" aria-label="ApplyForME home">
          <img
            [src]="logoSrc()"
            alt=""
            class="app-header__logo-img"
            width="160"
            height="40"
            loading="eager"
            decoding="async"
          />
        </a>

        <nav class="app-header__nav" [attr.aria-label]="t()['nav.ariaLabel']">
          <a
            routerLink="/dashboard"
            class="app-header__link"
            routerLinkActive="app-header__link--active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            {{ t()['nav.dashboard'] }}
          </a>
        </nav>

        <div class="app-header__actions">
          <app-theme-toggle />
          <app-language-toggle />
          @if (auth.user(); as user) {
            <span class="app-header__user" [title]="user.email">{{ user.email }}</span>
          }
          <app-button variant="ghost" size="compact" (clicked)="onLogOut()">
            {{ t()['header.logOut'] }}
          </app-button>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .app-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--color-bg);
        border-bottom: 1px solid var(--color-border);
        padding: var(--spacing-3) 0;
        transition:
          background-color var(--transition-duration) var(--transition-ease),
          border-color var(--transition-duration) var(--transition-ease);
      }

      .app-header__container {
        max-width: var(--max-content-width);
        margin: 0 auto;
        padding: 0 var(--spacing-4);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--spacing-4) var(--spacing-5);
      }

      .app-header__logo {
        flex-shrink: 0;
        text-decoration: none;
      }

      .app-header__logo-img {
        height: 32px;
        width: auto;
      }

      .app-header__nav {
        display: flex;
        align-items: center;
        gap: var(--spacing-4);
        flex: 1;
        min-width: 0;
      }

      .app-header__link {
        position: relative;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
        text-decoration: none;
        padding: var(--spacing-2) 0;
        transition: color var(--transition-duration) var(--transition-ease);
      }

      .app-header__link:hover {
        color: var(--color-text);
      }

      .app-header__link--active {
        color: var(--color-primary);
      }

      .app-header__link--active::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: -2px;
        height: 2px;
        background: var(--color-primary);
        border-radius: var(--radius-badge);
      }

      .app-header__actions {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        margin-left: auto;
        flex-shrink: 0;
      }

      .app-header__user {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        padding: 0 var(--spacing-2);
      }

      @media (max-width: 768px) {
        .app-header__container {
          gap: var(--spacing-3) var(--spacing-4);
        }

        .app-header__user {
          display: none;
        }

        .app-header__logo-img {
          height: 28px;
        }
      }

      @media (max-width: 640px) {
        .app-header__nav {
          display: none;
        }
      }

      @media (max-width: 480px) {
        .app-header {
          padding: var(--spacing-2) 0;
        }

        .app-header__container {
          gap: var(--spacing-2) var(--spacing-3);
          padding: 0 var(--spacing-3);
        }

        .app-header__logo-img {
          height: 24px;
        }

        .app-header__actions {
          gap: var(--spacing-1);
        }
      }
    `,
  ],
})
export class HeaderComponent {
  private i18n = inject(I18nService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  auth = inject(AuthService);

  t = computed(() => this.i18n.t());

  logoSrc = computed(() =>
    this.themeService.effectiveTheme() === 'dark'
      ? '/assets/brand/logo-full-dark.svg'
      : '/assets/brand/logo-full.svg',
  );

  onLogOut(): void {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/'], { replaceUrl: true });
    });
  }
}
