import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ThemeService } from '../../../core/layout/theme.service';

@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="landing-footer" role="contentinfo">
      <div class="landing-footer__container">
        <div class="landing-footer__grid">
          <div class="landing-footer__brand">
            <a href="/" class="landing-footer__logo" aria-label="ApplyForME home">
              <img src="/assets/brand/logo.png" alt="" class="landing-footer__logo-img" [class.landing-footer__logo-img--dark]="isDark()">
            </a>
            <p class="landing-footer__tagline">{{ t()['footer.madeWith'] }}</p>
          </div>

          <nav class="landing-footer__nav" aria-label="Product links">
            <h3 class="landing-footer__nav-title">{{ t()['footer.product'] }}</h3>
            <ul class="landing-footer__nav-list">
              <li><a href="#">{{ t()['footer.pricing'] }}</a></li>
              <li><a href="#">{{ t()['footer.changelog'] }}</a></li>
              <li><a href="#">{{ t()['footer.docs'] }}</a></li>
            </ul>
          </nav>

          <nav class="landing-footer__nav" aria-label="Company links">
            <h3 class="landing-footer__nav-title">{{ t()['footer.company'] }}</h3>
            <ul class="landing-footer__nav-list">
              <li><a href="#">{{ t()['footer.about'] }}</a></li>
              <li><a href="#">{{ t()['footer.blog'] }}</a></li>
              <li><a href="#">{{ t()['footer.careers'] }}</a></li>
            </ul>
          </nav>

          <nav class="landing-footer__nav" aria-label="Legal links">
            <h3 class="landing-footer__nav-title">{{ t()['footer.legal'] }}</h3>
            <ul class="landing-footer__nav-list">
              <li><a href="#">{{ t()['footer.privacy'] }}</a></li>
              <li><a href="#">{{ t()['footer.terms'] }}</a></li>
              <li><a href="#">{{ t()['footer.cookies'] }}</a></li>
            </ul>
          </nav>
        </div>

        <div class="landing-footer__bottom">
          <p class="landing-footer__copyright">{{ t()['footer.copyright'] }}</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .landing-footer {
      background: var(--color-bg);
      border-top: 1px solid var(--color-border);
      padding: var(--spacing-8) 0 var(--spacing-5);
    }

    .landing-footer__container {
      max-width: var(--max-content-width);
      margin: 0 auto;
      padding: 0 var(--spacing-4);
    }

    .landing-footer__grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--spacing-6);
      margin-bottom: var(--spacing-6);
    }

    @media (min-width: 640px) {
      .landing-footer__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .landing-footer__grid {
        grid-template-columns: 2fr repeat(3, 1fr);
      }
    }

    .landing-footer__logo {
      text-decoration: none;
      display: inline-block;
      margin-bottom: var(--spacing-3);
    }

    .landing-footer__logo-img {
      height: 36px;
      width: auto;
      border-radius: 4px;
    }

    .landing-footer__logo-img--dark {
      background: var(--color-surface);
      padding: 4px 8px;
      border-radius: 12px;
    }

    .landing-footer__tagline {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
      max-width: 280px;
    }

    .landing-footer__nav-title {
      font-family: var(--font-heading);
      font-weight: var(--font-weight-semibold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text);
      margin: 0 0 var(--spacing-3);
    }

    .landing-footer__nav-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .landing-footer__nav-list a {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      transition: color var(--transition-duration) var(--transition-ease);
    }

    .landing-footer__nav-list a:hover {
      color: var(--color-primary);
    }

    .landing-footer__bottom {
      padding-top: var(--spacing-5);
      border-top: 1px solid var(--color-border);
      text-align: center;
    }

    .landing-footer__copyright {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
    }
  `]
})
export class LandingFooterComponent {
  private i18n = inject(I18nService);
  private themeService = inject(ThemeService);

  t = computed(() => this.i18n.t());
  isDark = computed(() => this.themeService.effectiveTheme() === 'dark');
}