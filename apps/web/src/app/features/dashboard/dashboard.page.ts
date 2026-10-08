import type { ElementRef } from '@angular/core';
import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../core/layout/header.component';
import { SearchFilterBarComponent } from './components/search-filter-bar/search-filter-bar.component';
import { JobCardsGridComponent } from './components/job-cards-grid/job-cards-grid.component';
import {
  ScraperSidebarComponent,
  type ScraperRun,
} from './components/scraper-sidebar/scraper-sidebar.component';
import { DashboardState } from './data/dashboard.state';
import { ExtensionTasksComponent } from './components/extension-tasks/extension-tasks.component';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SearchFilterBarComponent,
    JobCardsGridComponent,
    ScraperSidebarComponent,
    ExtensionTasksComponent,
  ],
  template: `
    <div class="dashboard">
      <app-header />

      <div class="dashboard__shell">
        <div
          id="dashboard-sidebar"
          #scraperPanel
          class="dashboard__sidebar"
          [class.dashboard__sidebar--open]="sidebarOpen()"
        >
          <app-scraper-sidebar
            [filters]="state.filters()"
            [query]="state.query()"
            [running]="state.scraperRunning()"
            (run)="onRunScraper($event)"
          />
        </div>

        <main class="dashboard__main" [attr.aria-busy]="state.loading()">
          <button
            type="button"
            class="dashboard__sidebar-toggle"
            [attr.aria-expanded]="sidebarOpen()"
            aria-controls="dashboard-sidebar"
            (click)="sidebarOpen.set(!sidebarOpen())"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none">
              <path
                d="M4 7h16M4 12h10M4 17h7"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            <span>
              {{ sidebarOpen() ? t()['dashboard.hideScraper'] : t()['dashboard.scraperSettings'] }}
            </span>
            <svg
              class="dashboard__sidebar-chevron"
              [class.dashboard__sidebar-chevron--open]="sidebarOpen()"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                stroke-width="1.8"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

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
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  stroke="currentColor"
                  stroke-width="1.6"
                  fill="none"
                />
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

          @if (banner(); as text) {
            <div class="dashboard__notice" role="status">
              <span>{{ text }}</span>
              <button
                type="button"
                class="dashboard__notice-close"
                [attr.aria-label]="t()['dashboard.dismiss']"
                (click)="dismissBanner()"
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

          @if (state.scraperRun(); as run) {
            @if (run.extensionTasks.length > 0) {
              <app-extension-tasks
                [run]="run"
                [pendingId]="state.taskActionPendingId()"
                [error]="state.taskActionError()"
                (action)="state.updateExtensionTask(run.id, $event.taskId, $event.action)"
              />
            }
          }

          <app-search-filter-bar
            [filters]="state.filters()"
            [query]="state.query()"
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
            (openScraper)="openScraperPanel()"
          />
        </main>
      </div>
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

      .dashboard__shell {
        flex: 1;
        width: 100%;
        max-width: var(--max-content-width);
        margin: 0 auto;
        padding: var(--spacing-5) var(--spacing-4) var(--spacing-8);
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--spacing-5);
        align-items: start;
      }

      .dashboard__sidebar {
        display: none;
        min-width: 0;
      }

      .dashboard__sidebar--open {
        display: block;
      }

      .dashboard__sidebar-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-2);
        width: 100%;
        min-height: 44px;
        padding: 0 var(--spacing-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
        cursor: pointer;
        transition:
          border-color var(--transition-duration) var(--transition-ease),
          background-color var(--transition-duration) var(--transition-ease);
      }

      .dashboard__sidebar-toggle:hover {
        border-color: var(--color-primary);
      }

      .dashboard__sidebar-toggle:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .dashboard__sidebar-chevron {
        margin-left: auto;
        transition: transform var(--transition-duration) var(--transition-ease);
      }

      .dashboard__sidebar-chevron--open {
        transform: rotate(180deg);
      }

      .dashboard__main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);
      }

      .dashboard__intro {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--spacing-3);
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
        flex-wrap: wrap;
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

      @media (min-width: 1024px) {
        .dashboard__shell {
          grid-template-columns: 300px minmax(0, 1fr);
          padding-top: var(--spacing-6);
        }

        .dashboard__sidebar {
          display: block;
          position: sticky;
          top: var(--spacing-6);
        }

        .dashboard__sidebar-toggle {
          display: none;
        }
      }

      @media (min-width: 1024px) and (max-height: 760px) {
        .dashboard__sidebar {
          position: static;
        }
      }

      @media (max-width: 768px) {
        .dashboard__shell {
          padding: var(--spacing-4) var(--spacing-4) var(--spacing-7);
          gap: var(--spacing-4);
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

  @ViewChild('scraperPanel') private scraperPanel?: ElementRef<HTMLElement>;

  readonly bannerDismissed = signal(false);
  readonly sidebarOpen = signal(false);

  t = computed(() => this.i18n.t());

  readonly banner = computed<string | null>(() => {
    if (this.bannerDismissed()) return null;
    const t = this.t();

    const runError = this.state.scraperRunError();
    if (runError) {
      return runError.startsWith('dashboard.') ? (t[runError] ?? runError) : runError;
    }

    const run = this.state.scraperRun();
    if (!run) return null;

    if (run.status === 'queued' || run.status === 'running') {
      return (t['dashboard.scraperRunning'] ?? '')
        .replace('{done}', String(run.progress.done))
        .replace('{total}', String(run.progress.total));
    }
    if (run.status === 'failed') {
      return (t['dashboard.scraperFailed'] ?? '').replace('{n}', String(run.errors.length));
    }
    return run.progress.found > 0
      ? (t['dashboard.scraperDone'] ?? '').replace('{n}', String(run.progress.found))
      : (t['dashboard.scraperNoJobs'] ?? '');
  });

  retry(): void {
    this.state.runSearch();
  }

  dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  onRunScraper(run: ScraperRun): void {
    this.bannerDismissed.set(false);
    this.sidebarOpen.set(false);
    this.state.startScraper({
      sources: run.filters.sources,
      keywords: run.query
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      countries: run.filters.countries,
      remoteOnly: run.filters.remoteTypes.includes('remote'),
      filters: run.filters,
    });
  }

  openScraperPanel(): void {
    this.sidebarOpen.set(true);
    setTimeout(() => {
      this.scraperPanel?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  markApplied(job: { id: string }): void {
    this.state.jobs.update((jobs) =>
      jobs.map((j) => (j.id === job.id ? { ...j, status: 'applied' as const } : j)),
    );
  }
}
