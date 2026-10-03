import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';

interface HowItWorksStep {
  number: string;
  titleKey: string;
  descKey: string;
  icon: string;
}

@Component({
  selector: 'app-landing-how-it-works',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="landing-how-it-works" aria-labelledby="how-it-works-title">
      <div class="landing-how-it-works__container">
        <header class="landing-how-it-works__header">
          <h2 id="how-it-works-title" class="landing-how-it-works__title">{{ t()['howItWorks.title'] }}</h2>
          <p class="landing-how-it-works__subtitle">{{ t()['howItWorks.subtitle'] }}</p>
        </header>

        <div class="landing-how-it-works__steps">
          @for (step of steps; track step.number; let i = $index) {
            <article class="landing-how-it-works__step" [style.animation-delay.ms]="i * 150">
              <div class="landing-how-it-works__step-number">{{ step.number }}</div>
              <div class="landing-how-it-works__step-icon" [innerHTML]="step.icon" aria-hidden="true"></div>
              <h3 class="landing-how-it-works__step-title">{{ t()[step.titleKey] }}</h3>
              <p class="landing-how-it-works__step-desc">{{ t()[step.descKey] }}</p>
              @if (i < steps.length - 1) {
                <div class="landing-how-it-works__connector" aria-hidden="true"></div>
              }
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .landing-how-it-works {
      padding: var(--spacing-8) 0;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
    }

    .landing-how-it-works__container {
      max-width: var(--max-content-width);
      margin: 0 auto;
      padding: 0 var(--spacing-4);
    }

    .landing-how-it-works__header {
      text-align: center;
      margin-bottom: var(--spacing-8);
    }

    .landing-how-it-works__title {
      font-size: var(--text-2xl);
      margin-bottom: var(--spacing-2);
    }

    .landing-how-it-works__subtitle {
      font-size: var(--text-lg);
      color: var(--color-text-muted);
      max-width: 600px;
      margin: 0 auto;
    }

    .landing-how-it-works__steps {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-6);
    }

    @media (min-width: 768px) {
      .landing-how-it-works__steps {
        flex-direction: row;
        align-items: flex-start;
      }

      .landing-how-it-works__step {
        flex: 1;
        text-align: center;
        position: relative;
      }

      .landing-how-it-works__connector {
        position: absolute;
        top: 28px;
        right: -50%;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, var(--color-border) 50%, transparent 50%);
        background-size: 16px 2px;
        z-index: -1;
      }

      .landing-how-it-works__step:last-child .landing-how-it-works__connector {
        display: none;
      }
    }

    .landing-how-it-works__step {
      padding: var(--spacing-4);
    }

    .landing-how-it-works__step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--gradient-brand);
      color: var(--color-on-primary);
      font-family: var(--font-heading);
      font-weight: var(--font-weight-bold);
      font-size: var(--text-xl);
      margin-bottom: var(--spacing-4);
      box-shadow: 0 4px 16px rgba(214, 16, 28, 0.3);
      animation: popIn 500ms var(--transition-ease) both;
    }

    @keyframes popIn {
      from {
        opacity: 0;
        transform: scale(0.5);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .landing-how-it-works__step-icon {
      width: 56px;
      height: 56px;
      margin: 0 auto var(--spacing-4);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .landing-how-it-works__step-icon svg {
      width: 100%;
      height: 100%;
    }

    .landing-how-it-works__step-title {
      font-size: var(--text-lg);
      margin-bottom: var(--spacing-2);
    }

    .landing-how-it-works__step-desc {
      font-size: var(--text-base);
      color: var(--color-text-muted);
      line-height: var(--leading-relaxed);
      margin: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .landing-how-it-works__step-number {
        animation: none;
      }
    }
  `]
})
export class LandingHowItWorksComponent {
  private i18n = inject(I18nService);

  t = computed(() => this.i18n.t());

  steps: HowItWorksStep[] = [
    {
      number: '1',
      titleKey: 'howItWorks.step1.title',
      descKey: 'howItWorks.step1.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="21" x2="18" y2="17"/><line x1="15" y1="11" x2="13" y2="13"/></svg>'
    },
    {
      number: '2',
      titleKey: 'howItWorks.step2.title',
      descKey: 'howItWorks.step2.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
    },
    {
      number: '3',
      titleKey: 'howItWorks.step3.title',
      descKey: 'howItWorks.step3.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/></svg>'
    },
    {
      number: '4',
      titleKey: 'howItWorks.step4.title',
      descKey: 'howItWorks.step4.desc',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10"/><path d="M7 10l5 5 5-5"/><line x1="21" y1="15" x2="15" y2="21"/></svg>'
    }
  ];
}