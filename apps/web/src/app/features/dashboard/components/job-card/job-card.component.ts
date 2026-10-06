import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Job, JobStatus, ApplyMethod } from '@shared';
import type { BadgeTone } from '../../../../shared/ui/badge/badge.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { I18nService } from '../../../../core/i18n/i18n.service';

const STATUS_TONE: Record<JobStatus, BadgeTone> = {
  new: 'primary',
  saved: 'info',
  applied: 'success',
  skipped: 'neutral',
};

const METHOD_TONE: Record<ApplyMethod, BadgeTone> = {
  easy: 'success',
  external: 'info',
  email: 'info',
  manual: 'warning',
};

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [CommonModule, BadgeComponent, ButtonComponent],
  template: `
    <article
      class="job-card"
      [class.job-card--best]="bestMatch()"
      [attr.data-status]="job().status"
      [attr.data-score-level]="scoreLevel()"
      [attr.aria-labelledby]="'job-title-' + job().id"
    >
      <span class="job-card__accent" aria-hidden="true"></span>

      <div class="job-card__head">
        <span class="job-card__avatar" aria-hidden="true">{{ companyInitial() }}</span>
        <div class="job-card__head-text">
          @if (bestMatch()) {
            <span class="job-card__best">
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path
                  d="M6 10V2M6 2L2.5 5.5M6 2l3.5 3.5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
              </svg>
              {{ t()['jobCard.bestMatch'] }}
            </span>
          }
          <h3 class="job-card__title" [id]="'job-title-' + job().id">{{ job().title }}</h3>
        </div>
      </div>

      <p class="job-card__meta">
        <span class="job-card__company">{{ job().company }}</span>
        <span class="job-card__dot" aria-hidden="true">·</span>
        <span>{{ job().location }}</span>
        <span class="job-card__dot" aria-hidden="true">·</span>
        <span>{{ job().country | uppercase }}</span>
      </p>

      @if (job().description) {
        <p class="job-card__description">{{ job().description }}</p>
      }

      <div class="job-card__tags">
        <app-badge [tone]="scoreTone()">
          {{ t()['jobCard.score'] }} {{ job().matchScore }}
        </app-badge>
        <app-badge [tone]="statusTone()">{{ t()['jobCard.status.' + job().status] }}</app-badge>
        <app-badge [tone]="methodTone()">{{
          t()['jobCard.method.' + job().applyMethod]
        }}</app-badge>
        @if (job().remoteType !== 'all') {
          <app-badge tone="neutral">{{ t()['jobCard.remote.' + job().remoteType] }}</app-badge>
        }
      </div>

      @if (job().skills.length) {
        <ul class="job-card__skills" [attr.aria-label]="t()['jobCard.skills']">
          @for (skill of job().skills.slice(0, 4); track skill) {
            <li class="job-card__skill">{{ skill }}</li>
          }
          @if (job().skills.length > 4) {
            <li class="job-card__skill job-card__skill--more">+{{ job().skills.length - 4 }}</li>
          }
        </ul>
      }

      <div class="job-card__footer">
        <a
          class="job-card__link"
          [href]="job().url"
          target="_blank"
          rel="noopener noreferrer"
          (click)="openSite.emit(job())"
        >
          {{ t()['jobCard.openSite'] }}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M10 2h4v4M14 2L7 9"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
          <span class="visually-hidden">({{ t()['jobCard.openInNewTab'] }})</span>
        </a>

        @if (job().status !== 'applied') {
          <app-button variant="primary" size="compact" (clicked)="apply.emit(job())">
            {{ t()['jobCard.apply'] }}
          </app-button>
        } @else {
          <span class="job-card__applied">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M3 8.5l3.5 3.5L13 5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
            {{ t()['jobCard.applied'] }}
          </span>
        }
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .job-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4) var(--spacing-4) var(--spacing-4) calc(var(--spacing-4) + 4px);
        overflow: hidden;
        transition:
          border-color var(--transition-duration) var(--transition-ease),
          transform var(--transition-duration) var(--transition-ease);
        animation: card-enter 200ms var(--transition-ease) both;
      }

      @keyframes card-enter {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .job-card:hover {
        border-color: var(--color-primary);
      }

      .job-card__accent {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: var(--color-text-muted);
      }

      .job-card[data-score-level='high'] .job-card__accent {
        background: var(--color-success);
      }

      .job-card[data-score-level='mid'] .job-card__accent {
        background: var(--color-info);
      }

      .job-card[data-score-level='low'] .job-card__accent {
        background: var(--color-warning);
      }

      .job-card__head {
        display: flex;
        gap: var(--spacing-3);
        align-items: flex-start;
      }

      .job-card__avatar {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-input);
        background: var(--color-primary-soft);
        color: var(--color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-heading);
        font-weight: var(--font-weight-bold);
        font-size: var(--text-base);
        text-transform: uppercase;
      }

      .job-card__head-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
      }

      .job-card__best {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        width: fit-content;
        padding: 1px var(--spacing-2);
        border-radius: var(--radius-badge);
        background: var(--color-primary-soft);
        color: var(--color-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
      }

      .job-card__title {
        font-family: var(--font-heading);
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-tight);
        color: var(--color-text);
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .job-card__meta {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-1);
        align-items: center;
      }

      .job-card__company {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
      }

      .job-card__dot {
        opacity: 0.6;
      }

      .job-card__description {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        line-height: var(--leading-normal);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .job-card__tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-2);
      }

      .job-card__skills {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-2);
      }

      .job-card__skill {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-badge);
        padding: 1px var(--spacing-2);
      }

      .job-card__skill--more {
        color: var(--color-primary);
        border-color: var(--color-primary-soft);
        background: var(--color-primary-soft);
        font-weight: var(--font-weight-semibold);
      }

      .job-card__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-3);
        margin-top: auto;
        padding-top: var(--spacing-3);
        border-top: 1px solid var(--color-border);
      }

      .job-card__link {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
        min-height: 44px;
      }

      .job-card__link:hover {
        color: var(--color-primary-hover);
      }

      .job-card__applied {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-success);
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class JobCardComponent {
  private i18n = inject(I18nService);

  job = input.required<Job>();
  bestMatch = input(false);

  openSite = output<Job>();
  apply = output<Job>();

  t = computed(() => this.i18n.t());

  companyInitial = computed(() => this.job().company.trim().charAt(0) || '?');

  scoreLevel = computed<'high' | 'mid' | 'low'>(() => {
    const score = this.job().matchScore;
    if (score >= 75) return 'high';
    if (score >= 50) return 'mid';
    return 'low';
  });

  scoreTone = computed<BadgeTone>(() => {
    const level = this.scoreLevel();
    return level === 'high' ? 'success' : level === 'mid' ? 'info' : 'warning';
  });

  statusTone = computed<BadgeTone>(() => STATUS_TONE[this.job().status]);
  methodTone = computed<BadgeTone>(() => METHOD_TONE[this.job().applyMethod]);
}
