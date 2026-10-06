import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

@Component({
  selector: 'app-landing-cta',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <section class="landing-cta" aria-labelledby="cta-title">
      <div class="landing-cta__container">
        <div class="landing-cta__content">
          <h2 id="cta-title" class="landing-cta__title">{{ t()['cta.title'] }}</h2>
          <app-button variant="primary" [gradient]="true" size="default" (clicked)="onCtaClick()">
            {{ t()['cta.button'] }}
          </app-button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .landing-cta {
        padding: var(--spacing-8) 0;
        background: var(--color-surface);
        border-top: 1px solid var(--color-border);
      }

      .landing-cta__container {
        max-width: var(--max-content-width);
        margin: 0 auto;
        padding: 0 var(--spacing-4);
        text-align: center;
      }

      .landing-cta__content {
        max-width: 560px;
        margin: 0 auto;
      }

      .landing-cta__title {
        font-size: var(--text-2xl);
        margin-bottom: var(--spacing-5);
      }

      @media (max-width: 480px) {
        .landing-cta__title {
          font-size: var(--text-xl);
        }
      }
    `,
  ],
})
export class LandingCtaComponent {
  private i18n = inject(I18nService);
  private router = inject(Router);
  private auth = inject(AuthService);

  t = computed(() => this.i18n.t());

  onCtaClick(): void {
    this.router.navigate([this.auth.loggedIn() ? '/' : '/register']);
  }
}
