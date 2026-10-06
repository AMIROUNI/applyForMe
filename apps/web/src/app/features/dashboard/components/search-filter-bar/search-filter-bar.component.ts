import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type {
  DatePosted,
  ExperienceLevel,
  JobFilters,
  JobStatus,
  JobType,
  RemoteType,
} from '@shared';
import { emptyJobFilters } from '@shared';
import { MultiSelectComponent } from '../../../../shared/ui/multi-select/multi-select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import {
  COUNTRY_OPTIONS,
  DATE_POSTED_OPTIONS,
  EXPERIENCE_OPTIONS,
  JOB_TYPE_OPTIONS,
  MIN_SCORE_OPTIONS,
  REMOTE_OPTIONS,
  STATUS_OPTIONS,
} from '../../data/dashboard.constants';

const QUERY_DEBOUNCE_MS = 300;

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const sameFilters = (a: JobFilters, b: JobFilters): boolean =>
  a.minScore === b.minScore &&
  a.datePosted === b.datePosted &&
  sameList(a.countries, b.countries) &&
  sameList(a.sources, b.sources) &&
  sameList(a.statuses, b.statuses) &&
  sameList(a.experienceLevels, b.experienceLevels) &&
  sameList(a.remoteTypes, b.remoteTypes) &&
  sameList(a.jobTypes, b.jobTypes);

@Component({
  selector: 'app-search-filter-bar',
  standalone: true,
  imports: [CommonModule, MultiSelectComponent, ButtonComponent],
  template: `
    <section class="filter-bar" [attr.aria-label]="t()['filters.ariaLabel']">
      <div class="filter-bar__search">
        <svg
          class="filter-bar__search-icon"
          viewBox="0 0 20 20"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8" fill="none" />
          <path
            d="M13.5 13.5L17 17"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        <label class="visually-hidden" for="job-search">{{ t()['filters.search'] }}</label>
        <input
          id="job-search"
          class="filter-bar__search-input"
          type="search"
          autocomplete="off"
          [placeholder]="t()['filters.searchPlaceholder']"
          [value]="queryDraft()"
          (input)="onQueryInput($any($event.target).value)"
          (keydown.enter)="applyFilters()"
        />
        @if (queryDraft()) {
          <button
            type="button"
            class="filter-bar__search-clear"
            [attr.aria-label]="t()['filters.clearSearch']"
            (click)="clearQuery()"
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
        }
      </div>

      <div class="filter-bar__filters">
        <app-multi-select
          [label]="t()['filters.country']"
          [options]="countryOptions()"
          [selected]="draft().countries"
          [placeholder]="t()['filters.any']"
          [clearLabel]="t()['filters.clear']"
          [emptyLabel]="t()['filters.noOptions']"
          (selectionChange)="patchDraft({ countries: $event })"
        />

        <app-multi-select
          [label]="t()['filters.status']"
          [options]="statusOptions()"
          [selected]="draft().statuses"
          [placeholder]="t()['filters.any']"
          [clearLabel]="t()['filters.clear']"
          [emptyLabel]="t()['filters.noOptions']"
          (selectionChange)="onStatusesChange($event)"
        />

        <label class="filter-bar__field">
          <span class="visually-hidden">{{ t()['filters.experience'] }}</span>
          <select
            class="filter-bar__select"
            [value]="singleExperience()"
            (change)="onExperienceChange($any($event.target).value)"
          >
            <option value="">{{ t()['filters.experience'] }} — {{ t()['filters.any'] }}</option>
            @for (opt of experienceOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="singleExperience() === opt.value">
                {{ opt.label }}
              </option>
            }
          </select>
        </label>

        <label class="filter-bar__field">
          <span class="visually-hidden">{{ t()['filters.remote'] }}</span>
          <select
            class="filter-bar__select"
            [value]="singleRemote()"
            (change)="onRemoteChange($any($event.target).value)"
          >
            <option value="">{{ t()['filters.remote'] }} — {{ t()['filters.any'] }}</option>
            @for (opt of remoteOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="singleRemote() === opt.value">
                {{ opt.label }}
              </option>
            }
          </select>
        </label>

        <label class="filter-bar__field">
          <span class="visually-hidden">{{ t()['filters.jobType'] }}</span>
          <select
            class="filter-bar__select"
            [value]="singleJobType()"
            (change)="onJobTypeChange($any($event.target).value)"
          >
            <option value="">{{ t()['filters.jobType'] }} — {{ t()['filters.any'] }}</option>
            @for (opt of jobTypeOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="singleJobType() === opt.value">
                {{ opt.label }}
              </option>
            }
          </select>
        </label>

        <label class="filter-bar__field">
          <span class="visually-hidden">{{ t()['filters.datePosted'] }}</span>
          <select
            class="filter-bar__select"
            [value]="draft().datePosted"
            (change)="onDatePostedChange($any($event.target).value)"
          >
            @for (opt of datePostedOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="draft().datePosted === opt.value">
                {{ opt.label }}
              </option>
            }
          </select>
        </label>

        <label class="filter-bar__field">
          <span class="visually-hidden">{{ t()['filters.minScore'] }}</span>
          <select
            class="filter-bar__select"
            [value]="minScoreValue()"
            (change)="onMinScoreChange($any($event.target).value)"
          >
            @for (opt of minScoreOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="minScoreValue() === opt.value">
                {{ opt.label }}
              </option>
            }
          </select>
        </label>

        <div class="filter-bar__actions">
          <app-button variant="primary" size="compact" (clicked)="applyFilters()">
            {{ t()['filters.apply'] }}
          </app-button>
          @if (activeFilterCount() > 0 || queryDraft()) {
            <button type="button" class="filter-bar__clear" (click)="onClearAll()">
              {{ t()['filters.clearAll'] }}
              <span class="filter-bar__count" [attr.aria-label]="t()['filters.activeCount']">
                {{ activeFilterCount() }}
              </span>
            </button>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .filter-bar {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4);
      }

      .filter-bar__search {
        position: relative;
        display: flex;
        align-items: center;
      }

      .filter-bar__search-icon {
        position: absolute;
        left: var(--spacing-3);
        color: var(--color-text-muted);
        pointer-events: none;
      }

      .filter-bar__search-input {
        width: 100%;
        height: 48px;
        padding: 0 var(--spacing-7) 0 var(--spacing-7);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        font-family: var(--font-body);
        font-size: var(--text-base);
        color: var(--color-text);
        transition:
          border-color var(--transition-duration) var(--transition-ease),
          background-color var(--transition-duration) var(--transition-ease);
      }

      .filter-bar__search-input::placeholder {
        color: var(--color-text-muted);
      }

      .filter-bar__search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-focus-ring);
        background: var(--color-surface);
      }

      .filter-bar__search-input::-webkit-search-cancel-button {
        display: none;
      }

      .filter-bar__search-clear {
        position: absolute;
        right: var(--spacing-3);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        border-radius: var(--radius-badge);
        cursor: pointer;
      }

      .filter-bar__search-clear:hover {
        background: var(--color-border);
        color: var(--color-text);
      }

      .filter-bar__filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--spacing-2);
      }

      .filter-bar__filters > app-multi-select,
      .filter-bar__actions {
        flex-shrink: 0;
      }

      .filter-bar__field {
        display: inline-flex;
        flex-shrink: 0;
      }

      .filter-bar__select {
        height: 44px;
        padding: 0 var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text);
        cursor: pointer;
        max-width: 220px;
        transition: border-color var(--transition-duration) var(--transition-ease);
      }

      .filter-bar__select:hover {
        border-color: var(--color-primary);
      }

      .filter-bar__select:focus-visible {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .filter-bar__actions {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        margin-left: auto;
      }

      .filter-bar__clear {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        height: 40px;
        padding: 0 var(--spacing-3);
        background: transparent;
        border: none;
        color: var(--color-danger);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        border-radius: var(--radius-input);
        transition: background-color var(--transition-duration) var(--transition-ease);
      }

      .filter-bar__clear:hover {
        background: var(--color-danger-soft);
      }

      .filter-bar__clear:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .filter-bar__count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: var(--radius-badge);
        background: var(--color-danger-soft);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
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

      @media (max-width: 768px) {
        .filter-bar {
          padding: var(--spacing-3);
        }

        .filter-bar__search-input {
          height: 44px;
        }

        .filter-bar__filters > app-multi-select,
        .filter-bar__field {
          flex: 1 1 180px;
          min-width: 0;
        }

        .filter-bar__select {
          width: 100%;
          max-width: none;
        }

        .filter-bar__actions {
          flex: 1 1 100%;
          margin-left: 0;
          justify-content: flex-start;
        }
      }

      @media (max-width: 480px) {
        .filter-bar__filters > app-multi-select,
        .filter-bar__field {
          flex: 1 1 100%;
        }
      }
    `,
  ],
})
export class SearchFilterBarComponent {
  private i18n = inject(I18nService);
  private queryTimer: ReturnType<typeof setTimeout> | null = null;

  filters = input<JobFilters>(emptyJobFilters());
  query = input('');
  loading = input(false);

  queryChange = output<string>();
  filtersChange = output<JobFilters>();
  clearAll = output<void>();

  queryDraft = signal('');
  draft = signal<JobFilters>(emptyJobFilters());

  t = computed(() => this.i18n.t());

  countryOptions = computed(() =>
    COUNTRY_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.label })),
  );
  statusOptions = computed(() =>
    STATUS_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.value })),
  );
  experienceOptions = computed(() =>
    EXPERIENCE_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.value })),
  );
  remoteOptions = computed(() =>
    REMOTE_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.value })),
  );
  jobTypeOptions = computed(() =>
    JOB_TYPE_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.value })),
  );
  datePostedOptions = computed(() =>
    DATE_POSTED_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.value })),
  );
  minScoreOptions = computed(() =>
    MIN_SCORE_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.label })),
  );

  singleExperience = computed(() => this.draft().experienceLevels[0] ?? '');
  singleRemote = computed(() => this.draft().remoteTypes[0] ?? '');
  singleJobType = computed(() => this.draft().jobTypes[0] ?? '');
  minScoreValue = computed(() =>
    this.draft().minScore === null ? '' : String(this.draft().minScore),
  );

  constructor() {
    effect(() => {
      const incoming = this.filters();
      const current = untracked(() => this.draft());
      if (!sameFilters(incoming, current)) this.draft.set(incoming);
    });

    effect(() => {
      const incoming = this.query();
      const current = untracked(() => this.queryDraft());
      if (incoming !== current && incoming !== current.trim()) {
        this.queryDraft.set(incoming);
      }
    });
  }

  activeFilterCount = computed(() => {
    const f = this.draft();
    return (
      f.countries.length +
      f.sources.length +
      f.statuses.length +
      f.experienceLevels.length +
      f.remoteTypes.length +
      f.jobTypes.length +
      (f.minScore !== null ? 1 : 0) +
      (f.datePosted !== 'all' ? 1 : 0)
    );
  });

  onQueryInput(value: string): void {
    this.queryDraft.set(value);
    if (this.queryTimer !== null) {
      clearTimeout(this.queryTimer);
    }
    this.queryTimer = setTimeout(() => {
      this.queryTimer = null;
      this.queryChange.emit(value.trim());
    }, QUERY_DEBOUNCE_MS);
  }

  clearQuery(): void {
    this.queryDraft.set('');
    if (this.queryTimer !== null) {
      clearTimeout(this.queryTimer);
      this.queryTimer = null;
    }
    this.queryChange.emit('');
  }

  patchDraft(patch: Partial<JobFilters>): void {
    this.draft.update((f) => ({ ...f, ...patch }));
  }

  applyFilters(): void {
    this.filtersChange.emit(this.draft());
  }

  onReset(): void {
    this.queryDraft.set('');
    this.draft.set(emptyJobFilters());
  }

  toArray(value: string): string[] {
    return value ? [value] : [];
  }

  onStatusesChange(values: string[]): void {
    this.patchDraft({ statuses: values as JobStatus[] });
  }

  onExperienceChange(value: string): void {
    this.patchDraft({ experienceLevels: this.toArray(value) as ExperienceLevel[] });
  }

  onRemoteChange(value: string): void {
    this.patchDraft({ remoteTypes: this.toArray(value) as RemoteType[] });
  }

  onJobTypeChange(value: string): void {
    this.patchDraft({ jobTypes: this.toArray(value) as JobType[] });
  }

  onDatePostedChange(value: string): void {
    this.patchDraft({ datePosted: value as DatePosted });
  }

  onMinScoreChange(value: string): void {
    this.patchDraft({ minScore: value ? Number(value) : null });
  }

  onClearAll(): void {
    this.onReset();
    if (this.queryTimer !== null) {
      clearTimeout(this.queryTimer);
      this.queryTimer = null;
    }
    this.queryChange.emit('');
    this.filtersChange.emit(emptyJobFilters());
    this.clearAll.emit();
  }
}
