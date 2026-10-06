import { Injectable, computed, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { interval, startWith, switchMap } from 'rxjs';
import type { Job, JobFilters, JobSort, ScraperRun, ScraperRunStart } from '@shared';
import { emptyJobFilters } from '@shared';
import { JobsService } from './jobs.service';

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 1500;

const countActiveFilters = (f: JobFilters): number =>
  f.countries.length +
  f.sources.length +
  f.statuses.length +
  f.experienceLevels.length +
  f.remoteTypes.length +
  f.jobTypes.length +
  (f.minScore !== null ? 1 : 0) +
  (f.datePosted !== 'all' ? 1 : 0);

export interface ScraperRunParams {
  /** Filters applied to the search once the run finishes. */
  filters: JobFilters;
}

@Injectable({ providedIn: 'root' })
export class DashboardState {
  private jobsService = inject(JobsService);
  private fetchSub: Subscription | null = null;
  private pollSub: Subscription | null = null;

  readonly query = signal('');
  readonly filters = signal<JobFilters>(emptyJobFilters());
  readonly jobs = signal<Job[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly total = signal<number | null>(null);

  readonly scraperRunning = signal(false);
  readonly scraperRun = signal<ScraperRun | null>(null);
  readonly scraperRunError = signal<string | null>(null);

  readonly hasActiveSearch = computed(
    () => this.query().trim().length > 0 || countActiveFilters(this.filters()) > 0,
  );

  readonly hasMore = computed(() => {
    const total = this.total();
    if (total === null) return this.jobs().length >= PAGE_SIZE;
    return this.jobs().length < total;
  });

  readonly bestMatchIds = computed(() => {
    const top = [...this.jobs()]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3)
      .map((job) => job.id);
    return new Set(top);
  });

  constructor() {
    this.runSearch();
  }

  setQuery(query: string): void {
    this.query.set(query);
    this.runSearch();
  }

  setFilters(filters: JobFilters): void {
    this.filters.set(filters);
    this.runSearch();
  }

  clearSearch(): void {
    this.query.set('');
    this.filters.set(emptyJobFilters());
    this.runSearch();
  }

  /**
   * Starts a real scraper run on the API and polls it until it finishes. The
   * sidebar's keywords already shaped the scrape, so on completion the search
   * only re-applies the sidebar filters (no keyword re-match).
   */
  startScraper(params: ScraperRunStart & ScraperRunParams): void {
    if (this.scraperRunning()) return;
    this.scraperRunning.set(true);
    this.scraperRunError.set(null);
    this.scraperRun.set(null);

    const { filters, ...runStart } = params;
    this.jobsService.startScraperRun(runStart).subscribe({
      next: (run) => {
        this.scraperRun.set(run);
        this.pollRun(run.id, filters);
      },
      error: (err) => {
        this.scraperRunning.set(false);
        this.scraperRunError.set(err?.error?.message ?? 'dashboard.scraperStartFailed');
      },
    });
  }

  runSearch(sort: JobSort = 'matchScore'): void {
    this.fetch(1, sort, true);
  }

  loadMore(sort: JobSort = 'matchScore'): void {
    if (this.loading() || !this.hasMore()) return;
    this.fetch(this.page() + 1, sort, false);
  }

  private pollRun(runId: string, filters: JobFilters): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.jobsService.getScraperRun(runId)),
      )
      .subscribe({
        next: (run) => {
          this.scraperRun.set(run);
          if (run.status === 'done' || run.status === 'failed') {
            this.pollSub?.unsubscribe();
            this.scraperRunning.set(false);
            this.query.set('');
            this.filters.set(filters);
            this.runSearch();
          }
        },
        error: () => {
          this.pollSub?.unsubscribe();
          this.scraperRunning.set(false);
          this.scraperRunError.set('dashboard.scraperPollFailed');
        },
      });
  }

  private fetch(page: number, sort: JobSort, reset: boolean): void {
    this.fetchSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.fetchSub = this.jobsService
      .search({
        query: this.query(),
        filters: this.filters(),
        sort,
        page,
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.jobs.set(reset ? res.data : [...this.jobs(), ...res.data]);
          this.total.set(res.meta.total);
          this.page.set(res.meta.page);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('dashboard.error.loadFailed');
        },
      });
  }
}
