import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';

interface Feature {
  titleKey: string;
  descKey: string;
  icon: string;
}

@Component({
  selector: 'app-landing-features',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="landing-features" aria-labelledby="features-title">
      <div class="landing-features__container">
        <header class="landing-features__header">
          <h2 id="features-title" class="landing-features__title">{{ t()['features.title'] }}</h2>
          <p class="landing-features__subtitle">{{ t()['features.subtitle'] }}</p>
        </header>

        <div class="landing-features__grid">
          @for (feature of features; track feature.titleKey; let i = $index) {
            <article class="landing-features__card" [style.animation-delay.ms]="i * 100">
              <div class="landing-features__card-icon" [innerHTML]="feature.icon" aria-hidden="true"></div>
              <h3 class="landing-features__card-title">{{ t()[feature.titleKey] }}</h3>
              <p class="landing-features__card-desc">{{ t()[feature.descKey] }}</p>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .landing-features {
      padding: var(--spacing-8) 0;
      background: var(--color-bg);
    }

    .landing-features__container {
      max-width: var(--max-content-width);
      margin: 0 auto;
      padding: 0 var(--spacing-4);
    }

    .landing-features__header {
      text-align: center;
      margin-bottom: var(--spacing-8);
    }

    .landing-features__title {
      font-size: var(--text-2xl);
      margin-bottom: var(--spacing-2);
    }

    .landing-features__subtitle {
      font-size: var(--text-lg);
      color: var(--color-text-muted);
      max-width: 600px;
      margin: 0 auto;
    }

    .landing-features__grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--spacing-4);
    }

    @media (min-width: 640px) {
      .landing-features__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .landing-features__grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .landing-features__card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      padding: var(--spacing-6);
      transition: all var(--transition-duration) var(--transition-ease);
      animation: slideUpFade 500ms var(--transition-ease) both;
    }

    .landing-features__card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--elevation-light);
      transform: translateY(-4px);
    }

    @keyframes slideUpFade {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .landing-features__card-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      border-radius: 12px;
      margin-bottom: var(--spacing-4);
    }

    .landing-features__card-icon svg {
      width: 24px;
      height: 24px;
    }

    .landing-features__card-title {
      font-size: var(--text-lg);
      margin-bottom: var(--spacing-2);
    }

    .landing-features__card-desc {
      font-size: var(--text-base);
      color: var(--color-text-muted);
      line-height: var(--leading-relaxed);
      margin: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .landing-features__card {
        animation: none;
      }

      .landing-features__card:hover {
        transform: none;
      }
    }
  `]
})
export class LandingFeaturesComponent {
  private i18n = inject(I18nService);

  t = computed(() => this.i18n.t());

  features: Feature[] = [
    {
      titleKey: 'features.1.title',
      descKey: 'features.1.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
    },
    {
      titleKey: 'features.2.title',
      descKey: 'features.2.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10"/><path d="M7 10l5 5 5-5"/><line x1="21" y1="15" x2="15" y2="21"/></svg>'
    },
    {
      titleKey: 'features.3.title',
      descKey: 'features.3.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>'
    },
    {
      titleKey: 'features.4.title',
      descKey: 'features.4.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
    },
    {
      titleKey: 'features.5.title',
      descKey: 'features.5.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    },
    {
      titleKey: 'features.6.title',
      descKey: 'features.6.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
    }
  ];
}