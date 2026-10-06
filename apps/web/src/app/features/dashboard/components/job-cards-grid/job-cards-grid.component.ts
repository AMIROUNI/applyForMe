import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Job } from '@shared';
import { JobCardComponent } from '../job-card/job-card.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { I18nService } from '../../../../core/i18n/i18n.service';

const SKELETON_COUNT = 6;

@Component({
  selector: 'app-job-cards-grid',
  standalone: true,
  imports: [
    CommonModule,
    JobCardComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ButtonComponent,
  ],
  template: `
    @if (loading() && jobs().length === 0) {
      <div class="grid" role="status" [attr.aria-label]="t()['dashboard.loadingLabel']">
        @for (item of skeletonRows(); track item) {
          <div class="grid__skeleton" aria-hidden="true">
            <div class="grid__skeleton-head">
              <app-skeleton variant="circle" width="40px" height="40px" />
              <div class="grid__skeleton-title">
                <app-skeleton variant="text" width="80%" />
                <app-skeleton variant="text" width="50%" />
              </div>
            </div>
            <app-skeleton variant="text" width="70%" />
            <app-skeleton variant="text" width="90%" />
            <app-skeleton variant="text" width="60%" />
            <div class="grid__skeleton-tags">
              <app-skeleton variant="block" width="64px" height="22px" />
              <app-skeleton variant="block" width="56px" height="22px" />
              <app-skeleton variant="block" width="80px" height="22px" />
            </div>
          </div>
        }
      </div>
      <span class="visually-hidden">{{ t()['dashboard.loadingLabel'] }}</span>
    } @else if (jobs().length === 0) {
      <app-empty-state [title]="emptyTitle()" [description]="emptyDescription()">
        @if (hasActiveSearch()) {
          <app-button variant="secondary" (clicked)="resetSearch.emit()">
            {{ t()['dashboard.clearSearch'] }}
          </app-button>
        } @else {
          <app-button variant="primary" (clicked)="openScraper.emit()">
            {{ t()['dashboard.runFirstScraper'] }}
          </app-button>
        }
      </app-empty-state>
    } @else {
      <div class="grid">
        @for (job of jobs(); track job.id) {
          <app-job-card
            [job]="job"
            [bestMatch]="bestMatchIds().has(job.id)"
            (openSite)="openSite.emit($event)"
            (apply)="apply.emit($event)"
          />
        }
      </div>

      @if (hasMore()) {
        <div class="grid__more">
          <app-button variant="secondary" [loading]="loading()" (clicked)="loadMore.emit()">
            {{ t()['dashboard.loadMore'] }}
          </app-button>
        </div>
      }

      <p class="grid__count" aria-live="polite">
        {{ t()['dashboard.resultsCount'] }}: {{ jobs().length }}
        @if (total() !== null) {
          / {{ total() }}
        }
      </p>
    }
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--spacing-4);
      }

      .grid > * {
        min-width: 0;
      }

      .grid__skeleton {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4);
      }

      .grid__skeleton-head {
        display: flex;
        gap: var(--spacing-3);
        align-items: center;
      }

      .grid__skeleton-title {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
      }

      .grid__skeleton-tags {
        display: flex;
        gap: var(--spacing-2);
        margin-top: auto;
      }

      .grid__more {
        display: flex;
        justify-content: center;
        padding: var(--spacing-4) 0 0;
      }

      .grid__count {
        text-align: center;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        margin: var(--spacing-4) 0 0;
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

      @media (min-width: 640px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (min-width: 1280px) {
        .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class JobCardsGridComponent {
  private i18n = inject(I18nService);

  jobs = input<Job[]>([]);
  loading = input(false);
  hasMore = input(false);
  total = input<number | null>(null);
  hasActiveSearch = input(false);
  bestMatchIds = input<ReadonlySet<string>>(new Set<string>());

  loadMore = output<void>();
  apply = output<Job>();
  openSite = output<Job>();
  resetSearch = output<void>();
  openScraper = output<void>();

  t = computed(() => this.i18n.t());

  skeletonRows = computed(() => Array.from({ length: SKELETON_COUNT }, (_, i) => i));

  emptyTitle = computed(() =>
    this.hasActiveSearch()
      ? this.t()['dashboard.emptySearchTitle']
      : this.t()['dashboard.emptyTitle'],
  );

  emptyDescription = computed(() =>
    this.hasActiveSearch()
      ? this.t()['dashboard.emptySearchDesc']
      : this.t()['dashboard.emptyDesc'],
  );
}
