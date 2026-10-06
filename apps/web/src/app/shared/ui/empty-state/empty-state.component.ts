import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        @if (icon(); as icon) {
          <span [innerHTML]="icon"></span>
        } @else {
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect
              x="8"
              y="12"
              width="32"
              height="26"
              rx="4"
              stroke="currentColor"
              stroke-width="2.5"
            />
            <path d="M8 20h32" stroke="currentColor" stroke-width="2.5" />
            <circle cx="13" cy="16" r="1.5" fill="currentColor" />
            <circle cx="18" cy="16" r="1.5" fill="currentColor" />
            <path
              d="M17 28l4 4 8-8"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        }
      </div>
      <h3 class="empty-state__title">{{ title() }}</h3>
      @if (description()) {
        <p class="empty-state__description">{{ description() }}</p>
      }
      <div class="empty-state__action">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: var(--spacing-8) var(--spacing-4);
        max-width: 420px;
        margin: 0 auto;
      }

      .empty-state__icon {
        width: 72px;
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-4);
      }

      .empty-state__icon svg {
        width: 40px;
        height: 40px;
      }

      .empty-state__title {
        font-family: var(--font-heading);
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        margin: 0 0 var(--spacing-2);
      }

      .empty-state__description {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        margin: 0 0 var(--spacing-5);
        line-height: var(--leading-normal);
      }

      .empty-state__action:empty {
        display: none;
      }
    `,
  ],
})
export class EmptyStateComponent {
  title = input.required<string>();
  description = input<string>('');
  icon = input<string | null>(null);
}
