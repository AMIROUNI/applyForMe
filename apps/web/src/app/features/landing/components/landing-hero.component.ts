import { Component, computed, inject, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

interface MockJobCard {
  companyInitial: string;
  title: string;
  company: string;
  location: string;
  description: string;
  score: number;
  status: 'new' | 'saved' | 'applied';
  applyMethod: 'easy' | 'external' | 'email' | 'manual';
  isBestMatch: boolean;
}

@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <section class="landing-hero" aria-labelledby="hero-title">
      <div class="landing-hero__container">
        <div class="landing-hero__content">
          <h1 id="hero-title" class="landing-hero__title">{{ t()['hero.title'] }}</h1>
          <p class="landing-hero__subtitle">{{ t()['hero.subtitle'] }}</p>

          <div class="landing-hero__ctas">
            <app-button
              variant="primary"
              [gradient]="true"
              size="default"
              (clicked)="onPrimaryCtaClick()"
            >
              {{ t()['hero.ctaPrimary'] }}
              <svg class="landing-hero__arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </app-button>
            <app-button
              variant="secondary"
              size="default"
              (clicked)="onSecondaryCtaClick()"
            >
              {{ t()['hero.ctaSecondary'] }}
            </app-button>
          </div>

          <div class="landing-hero__trust">
            <span class="landing-hero__trust-text">{{ t()['hero.trustText'] || 'No credit card required · Cancel anytime' }}</span>
          </div>
        </div>

        <div class="landing-hero__visual" #heroVisual>
          <div class="landing-hero__mock-dashboard" role="img" aria-label="ApplyForME dashboard preview showing matched job cards">
            <div class="landing-hero__mock-header">
              <span class="landing-hero__mock-title">Your matches</span>
              <span class="landing-hero__mock-count">24 jobs found</span>
            </div>

            <div class="landing-hero__mock-cards">
              @for (job of mockJobs; track job.title; let i = $index) {
                <article
                  class="landing-hero__mock-card"
                  [class.landing-hero__mock-card--best]="job.isBestMatch"
                  [style.animation-delay.ms]="i * 150"
                  #cardEl
                >
                  @if (job.isBestMatch) {
                    <div class="landing-hero__best-badge" aria-label="Best match">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                      <span>{{ t()['hero.jobCard.bestMatch'] }}</span>
                    </div>
                  }

                  <div class="landing-hero__card-top">
                    <div class="landing-hero__company-avatar" [style.border-left-color]="getScoreColor(job.score)">
                      {{ job.companyInitial }}
                    </div>
                    <div class="landing-hero__card-title-area">
                      <h3 class="landing-hero__card-title">{{ job.title }}</h3>
                      <p class="landing-hero__card-meta">{{ job.company }} · {{ job.location }} · 🇹🇳</p>
                    </div>
                  </div>

                  <p class="landing-hero__card-description">{{ job.description }}</p>

                  <div class="landing-hero__card-badges">
                    <span class="landing-hero__badge" [class]="getScoreBadgeClass(job.score)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      {{ job.score }}
                    </span>
                    <span class="landing-hero__badge landing-hero__badge--status" [class]="getStatusBadgeClass(job.status)">
                      {{ getStatusLabel(job.status) }}
                    </span>
                    @if (job.applyMethod === 'manual') {
                      <span class="landing-hero__badge landing-hero__badge--method">
                        {{ t()['hero.jobCard.manual'] }}
                      </span>
                    }
                  </div>

                  <div class="landing-hero__card-divider"></div>

                  <div class="landing-hero__card-actions">
                    <button class="landing-hero__action-btn landing-hero__action-btn--secondary" type="button">
                      {{ t()['hero.jobCard.openSite'] }}
                    </button>
                    <button class="landing-hero__action-btn landing-hero__action-btn--primary" type="button">
                      {{ t()['hero.jobCard.apply'] }}
                    </button>
                  </div>
                </article>
              }
            </div>
          </div>

          <div class="landing-hero__decorations" aria-hidden="true">
            <div class="landing-hero__decoration landing-hero__decoration--1"></div>
            <div class="landing-hero__decoration landing-hero__decoration--2"></div>
            <div class="landing-hero__decoration landing-hero__decoration--3"></div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .landing-hero {
      padding: var(--spacing-8) 0;
      background: var(--color-bg);
      overflow: hidden;
    }

    .landing-hero__container {
      max-width: var(--max-content-width);
      margin: 0 auto;
      padding: 0 var(--spacing-4);
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--spacing-8);
      align-items: start;
    }

    @media (min-width: 1024px) {
      .landing-hero__container {
        grid-template-columns: 1fr 1fr;
        align-items: center;
      }
    }

    .landing-hero__content {
      max-width: 560px;
    }

    .landing-hero__title {
      font-size: var(--text-3xl);
      line-height: var(--leading-tight);
      margin-bottom: var(--spacing-4);
      color: var(--color-text);
    }

    .landing-hero__subtitle {
      font-size: var(--text-lg);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      margin-bottom: var(--spacing-6);
    }

    .landing-hero__ctas {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-3);
      margin-bottom: var(--spacing-6);
    }

    .landing-hero__arrow {
      flex-shrink: 0;
      transition: transform var(--transition-duration) var(--transition-ease);
    }

    app-button[variant="primary"]:hover .landing-hero__arrow {
      transform: translateX(4px);
    }

    .landing-hero__trust {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    /* Mock Dashboard Visual */
    .landing-hero__visual {
      position: relative;
      display: none;
    }

    @media (min-width: 768px) {
      .landing-hero__visual {
        display: block;
      }
    }

    .landing-hero__mock-dashboard {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      box-shadow: var(--elevation-light);
      overflow: hidden;
      position: relative;
      z-index: 1;
    }

    .landing-hero__mock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-5);
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-alt);
    }

    .landing-hero__mock-title {
      font-family: var(--font-heading);
      font-weight: var(--font-weight-semibold);
      font-size: var(--text-base);
      color: var(--color-text);
    }

    .landing-hero__mock-count {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .landing-hero__mock-cards {
      padding: var(--spacing-4);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .landing-hero__mock-card {
      position: relative;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      padding: var(--spacing-4);
      animation: slideUpFade 400ms var(--transition-ease) both;
      transition: box-shadow var(--transition-duration) var(--transition-ease), border-color var(--transition-duration) var(--transition-ease);
    }

    .landing-hero__mock-card:hover {
      box-shadow: var(--elevation-light);
      border-color: var(--color-primary);
    }

    .landing-hero__mock-card--best {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary), var(--elevation-light);
    }

    .landing-hero__mock-card--best::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--gradient-brand);
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }

    @keyframes slideUpFade {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .landing-hero__best-badge {
      position: absolute;
      top: -10px;
      right: var(--spacing-4);
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      background: var(--gradient-brand);
      color: var(--color-on-primary);
      font-size: var(--text-xs);
      font-weight: var(--font-weight-semibold);
      padding: 2px var(--spacing-2);
      border-radius: var(--radius-badge);
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(214, 16, 28, 0.3);
    }

    .landing-hero__card-top {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-3);
      margin-bottom: var(--spacing-3);
    }

    .landing-hero__company-avatar {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      border-left: 4px solid;
      background: var(--color-surface-alt);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-heading);
      font-weight: var(--font-weight-bold);
      font-size: var(--text-lg);
      color: var(--color-primary);
      flex-shrink: 0;
    }

    .landing-hero__card-title-area {
      flex: 1;
      min-width: 0;
    }

    .landing-hero__card-title {
      font-family: var(--font-heading);
      font-weight: var(--font-weight-semibold);
      font-size: var(--text-base);
      color: var(--color-text);
      margin: 0 0 var(--spacing-1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .landing-hero__card-meta {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .landing-hero__card-description {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      line-height: var(--leading-normal);
      margin: 0 0 var(--spacing-3);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .landing-hero__card-badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
      margin-bottom: var(--spacing-3);
    }

    .landing-hero__badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--text-xs);
      font-weight: var(--font-weight-medium);
      padding: 4px var(--spacing-2);
      border-radius: var(--radius-badge);
      white-space: nowrap;
    }

    .landing-hero__badge--success {
      background: var(--color-success-soft);
      color: var(--color-success);
    }

    .landing-hero__badge--info {
      background: var(--color-info-soft);
      color: var(--color-info);
    }

    .landing-hero__badge--warning {
      background: var(--color-warning-soft);
      color: var(--color-warning);
    }

    .landing-hero__badge--status {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .landing-hero__badge--method {
      background: var(--color-warning-soft);
      color: var(--color-warning);
    }

    .landing-hero__card-divider {
      height: 1px;
      background: var(--color-border);
      margin-bottom: var(--spacing-3);
    }

    .landing-hero__card-actions {
      display: flex;
      gap: var(--spacing-2);
    }

    .landing-hero__action-btn {
      flex: 1;
      height: 36px;
      padding: 0 var(--spacing-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-input);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-duration) var(--transition-ease);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .landing-hero__action-btn:hover {
      background: var(--color-surface-alt);
      border-color: var(--color-primary);
    }

    .landing-hero__action-btn--primary {
      background: var(--color-primary-fill);
      border-color: var(--color-primary-fill);
      color: var(--color-on-primary);
    }

    .landing-hero__action-btn--primary:hover {
      background: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
    }

    /* Decorations */
    .landing-hero__decorations {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    .landing-hero__decoration {
      position: absolute;
      border-radius: 50%;
      background: var(--gradient-brand);
      opacity: 0.08;
      filter: blur(60px);
    }

    .landing-hero__decoration--1 {
      width: 300px;
      height: 300px;
      top: -100px;
      right: -100px;
    }

    .landing-hero__decoration--2 {
      width: 200px;
      height: 200px;
      bottom: -50px;
      left: -50px;
      opacity: 0.05;
    }

    .landing-hero__decoration--3 {
      width: 150px;
      height: 150px;
      top: 50%;
      right: 10%;
      opacity: 0.04;
    }

    @media (max-width: 1023px) {
      .landing-hero__visual {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .landing-hero__mock-card {
        animation: none;
      }
    }
  `]
})
export class LandingHeroComponent implements AfterViewInit {
  private i18n = inject(I18nService);

  @ViewChildren('cardEl') cardElements!: QueryList<ElementRef>;

  t = computed(() => this.i18n.t());

  mockJobs: MockJobCard[] = [
    {
      companyInitial: 'G',
      title: 'Senior Full Stack Engineer',
      company: 'GitLab',
      location: 'Remote (EMEA)',
      description: 'Build features for the DevOps platform used by millions. Work on Git, CI/CD, and security tooling in a fully remote, async-first culture.',
      score: 92,
      status: 'new',
      applyMethod: 'easy',
      isBestMatch: true
    },
    {
      companyInitial: 'S',
      title: 'Frontend Engineer (React/TypeScript)',
      company: 'Stripe',
      location: 'Paris, France',
      description: 'Design and build delightful developer experiences for the Stripe Dashboard. Strong focus on accessibility, performance, and component architecture.',
      score: 87,
      status: 'new',
      applyMethod: 'easy',
      isBestMatch: true
    },
    {
      companyInitial: 'V',
      title: 'Backend Engineer - Payments',
      company: 'Vercel',
      location: 'Remote (Europe)',
      description: 'Scale the payment infrastructure powering millions of deployments. Work with Go, PostgreSQL, and distributed systems at global scale.',
      score: 78,
      status: 'new',
      applyMethod: 'manual',
      isBestMatch: false
    }
  ];

  ngAfterViewInit(): void {
    // IntersectionObserver for staggered animation on scroll into view
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-hero__mock-card--visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

      this.cardElements.forEach(el => observer.observe(el.nativeElement));
    }
  }

  getScoreColor(score: number): string {
    if (score >= 75) return 'var(--color-success)';
    if (score >= 50) return 'var(--color-info)';
    return 'var(--color-warning)';
  }

  getScoreBadgeClass(score: number): string {
    if (score >= 75) return 'landing-hero__badge--success';
    if (score >= 50) return 'landing-hero__badge--info';
    return 'landing-hero__badge--warning';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'new': return 'landing-hero__badge--status';
      case 'saved': return 'landing-hero__badge--info';
      case 'applied': return 'landing-hero__badge--success';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'new': return this.t()['hero.jobCard.new'];
      case 'saved': return 'Saved';
      case 'applied': return 'Applied';
      default: return status;
    }
  }

  onPrimaryCtaClick(): void {
    console.log('Primary CTA clicked');
  }

  onSecondaryCtaClick(): void {
    console.log('Secondary CTA clicked');
  }
}