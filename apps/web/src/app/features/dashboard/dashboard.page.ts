import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../core/layout/header.component';
import { SearchFilterBarComponent } from './components/search-filter-bar/search-filter-bar.component';
import { JobCardsGridComponent } from './components/job-cards-grid/job-cards-grid.component';
import { DashboardState } from './data/dashboard.state';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SearchFilterBarComponent, JobCardsGridComponent],
  template: `
    <div class="dashboard">
      <app-header />

      <main class="dashboard__main" [attr.aria-busy]="state.loading()">
        <header class="dashboard__intro">
          <div>
            <h1 class="dashboard__title">{{ t()['dashboard.title'] }}</h1>
            <p class="dashboard__subtitle" aria-live="polite">
              @if (state.loading() && state.jobs().length === 0) {
                {{ t()['dashboard.searching'] }}
              } @else if (state.total(); as total) {
                {{ t()['dashboard.found'] }} {{ total }} {{ t()['dashboard.jobsForYou'] }}
              } @else {
                {{ t()['dashboard.subtitle'] }}
              }
            </p>
          </div>
        </header>

        @if (state.error(); as errorKey) {
          <div class="dashboard__alert" role="alert">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6" fill="none" />
              <path
                d="M10 6v5M10 13.5v.5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            <span>{{ t()[errorKey] }}</span>
            <button type="button" class="dashboard__retry" (click)="retry()">
              {{ t()['dashboard.retry'] }}
            </button>
          </div>
        }

        @if (notice(); as noticeKey) {
          <div class="dashboard__notice" role="status">
            <span>{{ t()[noticeKey] }}</span>
            <button
              type="button"
              class="dashboard__notice-close"
              [attr.aria-label]="t()['dashboard.dismiss']"
              (click)="notice.set(null)"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        }

        <app-search-filter-bar
          [filters]="state.filters()"
          [loading]="state.loading()"
          (queryChange)="state.setQuery($event)"
          (filtersChange)="state.setFilters($event)"
        />

        <app-job-cards-grid
          [jobs]="state.jobs()"
          [loading]="state.loading()"
          [hasMore]="state.hasMore()"
          [total]="state.total()"
          [hasActiveSearch]="state.hasActiveSearch()"
          [bestMatchIds]="state.bestMatchIds()"
          (loadMore)="state.loadMore()"
          (apply)="markApplied($event)"
          (resetSearch)="state.clearSearch()"
          (openScraper)="showScraperNotice()"
        />
      </main>
    </div>
  `,
  styles: [
    `
      .dashboard {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--color-bg);
      }

      .dashboard__main {
        flex: 1;
        width: 100%;
        max-width: var(--max-content-width);
        margin: 0 auto;
        padding: var(--spacing-6) var(--spacing-4) var(--spacing-8);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);
      }

      .dashboard__intro {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--spacing-4);
      }

      .dashboard__title {
        font-family: var(--font-heading);
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        margin: 0 0 var(--spacing-1);
      }

      .dashboard__subtitle {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      .dashboard__alert {
        display: flex;
        align-items: center;
        gap: var(--spacing-3);
        padding: var(--spacing-3) var(--spacing-4);
        background: var(--color-danger-soft);
        border: 1px solid var(--color-danger);
        border-radius: var(--radius-input);
        color: var(--color-danger);
        font-size: var(--text-sm);
      }

      .dashboard__retry {
        margin-left: auto;
        background: transparent;
        border: 1px solid var(--color-danger);
        color: var(--color-danger);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-input);
        padding: var(--spacing-1) var(--spacing-3);
        min-height: 36px;
        cursor: pointer;
      }

      .dashboard__retry:hover {
        background: var(--color-surface);
      }

      .dashboard__notice {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-3);
        padding: var(--spacing-3) var(--spacing-4);
        background: var(--color-info-soft);
        border: 1px solid var(--color-info);
        border-radius: var(--radius-input);
        color: var(--color-info);
        font-size: var(--text-sm);
      }

      .dashboard__notice-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: inherit;
        border-radius: var(--radius-badge);
        cursor: pointer;
        flex-shrink: 0;
      }

      .dashboard__notice-close:hover {
        background: var(--color-surface);
      }

      @media (max-width: 768px) {
        .dashboard__main {
          padding: var(--spacing-4) var(--spacing-4) var(--spacing-7);
        }

        .dashboard__title {
          font-size: var(--text-xl);
        }
      }
    `,
  ],
})
export class DashboardPageComponent {
  readonly state = inject(DashboardState);
  private i18n = inject(I18nService);

  readonly notice = signal<string | null>(null);

  t = computed(() => this.i18n.t());

  retry(): void {
    this.state.runSearch();
  }

  showScraperNotice(): void {
    this.notice.set('dashboard.scraperComingSoon');
  }

  markApplied(job: { id: string }): void {
    this.state.jobs.update((jobs) =>
      jobs.map((j) => (j.id === job.id ? { ...j, status: 'applied' as const } : j)),
    );
  }
}
