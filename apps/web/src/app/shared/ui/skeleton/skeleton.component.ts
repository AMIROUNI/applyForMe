import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="skeleton"
      [class.skeleton--text]="variant() === 'text'"
      [class.skeleton--circle]="variant() === 'circle'"
      [style.width]="width()"
      [style.height]="height()"
      [attr.aria-hidden]="ariaHidden() ? 'true' : null"
      [attr.aria-label]="ariaHidden() ? null : 'Loading'"
      role="img"
    ></span>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      .skeleton {
        display: block;
        background: linear-gradient(
          90deg,
          var(--color-surface-alt) 25%,
          var(--color-border) 37%,
          var(--color-surface-alt) 63%
        );
        background-size: 400% 100%;
        animation: skeleton-shimmer 1.4s ease infinite;
        border-radius: var(--radius-input);
      }

      .skeleton--text {
        height: 1em;
        border-radius: var(--radius-badge);
      }

      .skeleton--circle {
        border-radius: 50%;
      }

      @keyframes skeleton-shimmer {
        0% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0 50%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .skeleton {
          animation: none;
        }
      }
    `,
  ],
})
export class SkeletonComponent {
  variant = input<'block' | 'text' | 'circle'>('block');
  width = input<string | null>(null);
  height = input<string | null>(null);
  ariaHidden = input(true);
}
