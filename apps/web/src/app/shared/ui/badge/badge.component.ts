import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'info' | 'warning' | 'danger';

const TONE_LABEL: Record<BadgeTone, string> = {
  neutral: 'badge--neutral',
  primary: 'badge--primary',
  success: 'badge--success',
  info: 'badge--info',
  warning: 'badge--warning',
  danger: 'badge--danger',
};

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="badgeClass()" [attr.data-tone]="tone()">
      @if (withDot()) {
        <span class="badge__dot" aria-hidden="true"></span>
      }
      <ng-content />
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        padding: 2px var(--spacing-2);
        border-radius: var(--radius-badge);
        font-family: var(--font-body);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        line-height: 1.4;
        white-space: nowrap;
      }

      .badge__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
      }

      .badge--neutral {
        background: var(--color-surface-alt);
        color: var(--color-text-muted);
        border: 1px solid var(--color-border);
      }

      .badge--primary {
        background: var(--color-primary-soft);
        color: var(--color-primary);
      }

      .badge--success {
        background: var(--color-success-soft);
        color: var(--color-success);
      }

      .badge--info {
        background: var(--color-info-soft);
        color: var(--color-info);
      }

      .badge--warning {
        background: var(--color-warning-soft);
        color: var(--color-warning);
      }

      .badge--danger {
        background: var(--color-danger-soft);
        color: var(--color-danger);
      }
    `,
  ],
})
export class BadgeComponent {
  tone = input<BadgeTone>('neutral');
  withDot = input(false);

  badgeClass = computed(() => `badge ${TONE_LABEL[this.tone()]}`);
}
