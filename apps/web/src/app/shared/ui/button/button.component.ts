import { Component, input, output, computed, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'compact';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="buttonClass()"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <svg class="button__spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 31.4">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
      } @else {
        <ng-content></ng-content>
      }
    </button>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      border: none;
      font-family: var(--font-body);
      font-weight: var(--font-weight-medium);
      border-radius: var(--radius-input);
      cursor: pointer;
      transition: all var(--transition-duration) var(--transition-ease);
      text-decoration: none;
      white-space: nowrap;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }

    .button__spinner {
      width: 18px;
      height: 18px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Variants */
    .btn--primary {
      height: 44px;
      padding: 0 var(--spacing-5);
      font-size: var(--text-base);
      background: var(--color-primary-fill);
      color: var(--color-on-primary);
    }

    .btn--primary:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    .btn--primary:active:not(:disabled) {
      background: var(--brand-700);
    }

    .btn--primary-gradient {
      background: var(--gradient-brand);
    }

    .btn--secondary {
      height: 44px;
      padding: 0 var(--spacing-5);
      font-size: var(--text-base);
      background: transparent;
      border: 1px solid var(--color-primary);
      color: var(--color-primary);
    }

    .btn--secondary:hover:not(:disabled) {
      background: var(--color-primary-soft);
    }

    .btn--ghost {
      height: 44px;
      padding: 0 var(--spacing-4);
      font-size: var(--text-base);
      background: transparent;
      color: var(--color-text);
    }

    .btn--ghost:hover:not(:disabled) {
      background: var(--color-surface-alt);
    }

    .btn--destructive {
      height: 44px;
      padding: 0 var(--spacing-5);
      font-size: var(--text-base);
      background: transparent;
      border: 1px solid var(--color-danger);
      color: var(--color-danger);
    }

    .btn--destructive:hover:not(:disabled) {
      background: var(--color-danger-soft);
    }

    /* Sizes */
    .btn--compact {
      height: 40px;
      padding: 0 var(--spacing-4);
      font-size: var(--text-sm);
    }

    .btn--secondary.btn--compact,
    .btn--ghost.btn--compact,
    .btn--destructive.btn--compact {
      height: 40px;
    }
  `]
})
export class ButtonComponent {
  type = input<'button' | 'submit' | 'reset'>('button');
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('default');
  disabled = input(false);
  loading = input(false);
  gradient = input(false);

  clicked = output<Event>();

  buttonClass = computed(() => {
    const base = 'btn';
    const variant = this.variant();
    const size = this.size();
    const gradient = this.gradient();

    let cls = `${base} btn--${variant}`;
    if (size === 'compact') {
      cls += ' btn--compact';
    }
    if (variant === 'primary' && gradient) {
      cls += ' btn--primary-gradient';
    }
    return cls;
  });

  onClick(event: Event): void {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}