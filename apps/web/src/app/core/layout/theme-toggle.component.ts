import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SafeHtml } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';
import type { ThemeMode } from './theme.service';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-toggle" role="group" aria-label="Theme selection">
      @for (mode of modes; track mode.value) {
        <button
          type="button"
          class="theme-toggle__btn"
          [class.theme-toggle__btn--active]="currentMode() === mode.value"
          (click)="setTheme(mode.value)"
          [attr.aria-pressed]="currentMode() === mode.value"
        >
          <span class="theme-toggle__icon" [innerHTML]="mode.icon"></span>
          <span class="theme-toggle__label">{{ mode.label }}</span>
        </button>
      }
    </div>
  `,
  styles: [
    `
      .theme-toggle {
        display: inline-flex;
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        padding: 2px;
        gap: 2px;
      }

      .theme-toggle__btn {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        padding: var(--spacing-1) var(--spacing-3);
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        border-radius: calc(var(--radius-input) - 2px);
        cursor: pointer;
        transition: all var(--transition-duration) var(--transition-ease);
        white-space: nowrap;
      }

      .theme-toggle__btn:hover {
        color: var(--color-text);
      }

      .theme-toggle__btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .theme-toggle__btn--active {
        background: var(--color-primary-fill);
        color: var(--color-on-primary);
      }

      .theme-toggle__btn--active:hover {
        background: var(--color-primary-hover);
        color: var(--color-on-primary);
      }

      .theme-toggle__icon {
        display: inline-flex;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      @media (max-width: 480px) {
        .theme-toggle__label {
          display: none;
        }

        .theme-toggle__btn {
          padding: var(--spacing-1) var(--spacing-2);
        }
      }
    `,
  ],
})
export class ThemeToggleComponent {
  private themeService = inject(ThemeService);
  private sanitizer = inject(DomSanitizer);

  modes: { value: ThemeMode; label: string; icon: SafeHtml }[] = [
    {
      value: 'system',
      label: 'System',
      icon: this.sanitizer.bypassSecurityTrustHtml(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      ),
    },
    {
      value: 'light',
      label: 'Light',
      icon: this.sanitizer.bypassSecurityTrustHtml(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: this.sanitizer.bypassSecurityTrustHtml(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
      ),
    },
  ];

  currentMode = computed(() => this.themeService.theme());

  setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }
}
