import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService, Locale } from './i18n.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="language-toggle" role="group" aria-label="Language selection">
      @for (lang of languages; track lang.code) {
        <button
          type="button"
          class="language-toggle__btn"
          [class.language-toggle__btn--active]="currentLang() === lang.code"
          (click)="setLang(lang.code)"
          [attr.aria-pressed]="currentLang() === lang.code"
        >
          {{ lang.label }}
        </button>
      }
    </div>
  `,
  styles: [`
    .language-toggle {
      display: inline-flex;
      background: var(--color-surface-alt);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-input);
      padding: 2px;
      gap: 2px;
    }

    .language-toggle__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 32px;
      padding: 0 var(--spacing-2);
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-semibold);
      border-radius: calc(var(--radius-input) - 2px);
      cursor: pointer;
      transition: all var(--transition-duration) var(--transition-ease);
    }

    .language-toggle__btn:hover {
      color: var(--color-text);
    }

    .language-toggle__btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }

    .language-toggle__btn--active {
      background: var(--color-primary-fill);
      color: var(--color-on-primary);
    }

    .language-toggle__btn--active:hover {
      background: var(--color-primary-hover);
      color: var(--color-on-primary);
    }
  `]
})
export class LanguageToggleComponent {
  private i18n = inject(I18nService);

  languages = [
    { code: 'en' as Locale, label: 'EN' },
    { code: 'fr' as Locale, label: 'FR' }
  ];

  currentLang = computed(() => this.i18n.lang());

  setLang(locale: Locale): void {
    this.i18n.setLang(locale);
  }
}