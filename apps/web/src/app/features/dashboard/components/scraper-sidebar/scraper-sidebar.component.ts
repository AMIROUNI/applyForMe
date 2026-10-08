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
import { RouterLink } from '@angular/router';
import type { JobFilters, JobSource } from '@shared';
import { emptyJobFilters } from '@shared';
import { MultiSelectComponent } from '../../../../shared/ui/multi-select/multi-select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { SourcesService } from '../../../sources/data/sources.service';
import { COUNTRY_OPTIONS, SOURCE_OPTIONS } from '../../data/dashboard.constants';

export interface ScraperRun {
  query: string;
  filters: JobFilters;
}

const splitKeywords = (value: string): string[] =>
  value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

@Component({
  selector: 'app-scraper-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, MultiSelectComponent, ButtonComponent],
  template: `
    <section class="scraper" [attr.aria-label]="t()['scraper.title']">
      <header class="scraper__head">
        <span class="scraper__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path
              d="M4 7h16M4 12h10M4 17h7"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <circle cx="18" cy="15.5" r="3.5" stroke="currentColor" stroke-width="1.8" />
            <path
              d="M20.5 18l2 2"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <div class="scraper__head-text">
          <h2 class="scraper__title">{{ t()['scraper.title'] }}</h2>
          <p class="scraper__subtitle">{{ t()['scraper.subtitle'] }}</p>
        </div>
      </header>

      <div class="scraper__field">
        <app-multi-select
          [label]="t()['scraper.countries']"
          [options]="countryOptions()"
          [selected]="countriesDraft()"
          [placeholder]="t()['filters.any']"
          [clearLabel]="t()['filters.clear']"
          [emptyLabel]="t()['filters.noOptions']"
          (selectionChange)="countriesDraft.set($event)"
        />
      </div>

      <div class="scraper__field">
        <app-multi-select
          [label]="t()['scraper.sources']"
          [options]="sourceOptions()"
          [selected]="sourcesDraft()"
          [placeholder]="t()['filters.any']"
          [clearLabel]="t()['filters.clear']"
          [emptyLabel]="t()['filters.noOptions']"
          (selectionChange)="sourcesDraft.set($event)"
        />
        <div class="scraper__row">
          <button type="button" class="scraper__link" (click)="selectAllRecommended()">
            {{ t()['scraper.selectRecommended'] }}
          </button>
          <span class="scraper__count">{{ sourceCountLabel() }}</span>
        </div>
        @if (activeSourceCount() === 0) {
          <p class="scraper__warn">{{ t()['scraper.noSources'] }}</p>
        }
      </div>

      <label class="scraper__field">
        <span class="scraper__label">{{ t()['scraper.keywords'] }}</span>
        <input
          class="scraper__input"
          type="text"
          autocomplete="off"
          [placeholder]="t()['scraper.keywordsPlaceholder']"
          [value]="keywordsDraft()"
          (input)="keywordsDraft.set($any($event.target).value)"
          (keydown.enter)="runScraper()"
        />
      </label>

      <label class="scraper__toggle">
        <input
          type="checkbox"
          [checked]="remoteOnlyDraft()"
          (change)="remoteOnlyDraft.set($any($event.target).checked)"
        />
        <span>{{ t()['scraper.remoteOnly'] }}</span>
      </label>

      <app-button
        variant="primary"
        [loading]="running()"
        (clicked)="runScraper()"
        class="scraper__run"
      >
        {{ t()['scraper.run'] }}
      </app-button>

      <p class="scraper__hint">{{ t()['scraper.hint'] }}</p>

      <a class="scraper__manage" routerLink="/sources">
        {{ t()['scraper.manageSources'] }}
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none">
          <path
            d="M6 3l5 5-5 5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .scraper {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4);
      }

      .scraper__head {
        display: flex;
        gap: var(--spacing-3);
        align-items: flex-start;
      }

      .scraper__mark {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-input);
        background: var(--color-primary-soft);
        color: var(--color-primary);
      }

      .scraper__head-text {
        min-width: 0;
      }

      .scraper__title {
        font-family: var(--font-heading);
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text);
      }

      .scraper__subtitle {
        margin: var(--spacing-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--color-text-muted);
      }

      .scraper__field {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
      }

      .scraper__field app-multi-select,
      .scraper__field .multi-select {
        width: 100%;
      }

      .scraper__label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
      }

      .scraper__input {
        width: 100%;
        height: 44px;
        padding: 0 var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text);
        transition: border-color var(--transition-duration) var(--transition-ease);
      }

      .scraper__input::placeholder {
        color: var(--color-text-muted);
      }

      .scraper__input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .scraper__toggle {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        min-height: 44px;
        font-size: var(--text-sm);
        color: var(--color-text);
        cursor: pointer;
      }

      .scraper__toggle input {
        width: 18px;
        height: 18px;
        accent-color: var(--color-primary-fill);
        cursor: pointer;
      }

      .scraper__run {
        width: 100%;
      }

      .scraper__hint {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--color-text-muted);
      }

      .scraper__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .scraper__link {
        padding: 0;
        border: none;
        background: transparent;
        font-family: var(--font-body);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
        cursor: pointer;
        text-align: left;
      }

      .scraper__link:hover {
        text-decoration: underline;
      }

      .scraper__link:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-focus-ring);
        border-radius: var(--radius-badge);
      }

      .scraper__count {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .scraper__warn {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-warning);
      }

      .scraper__manage {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-1);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
        text-decoration: none;
        min-height: 32px;
      }

      .scraper__manage:hover {
        color: var(--color-primary);
      }
    `,
  ],
})
export class ScraperSidebarComponent {
  private i18n = inject(I18nService);
  private sourcesService = inject(SourcesService);

  filters = input<JobFilters>(emptyJobFilters());
  query = input('');
  running = input(false);

  run = output<ScraperRun>();

  sourcesDraft = signal<string[]>([]);
  countriesDraft = signal<string[]>([]);
  keywordsDraft = signal('');
  remoteOnlyDraft = signal(false);

  /** Registry contents; empty + loaded => fall back to the hard-coded list. */
  registry = signal<JobSource[]>([]);
  registryLoaded = signal(false);

  t = computed(() => this.i18n.t());

  private hasTokenFor(source: JobSource): boolean {
    return !source.requiresUserToken;
  }

  private isRunnable(source: JobSource): boolean {
    return source.status === 'active' && this.hasTokenFor(source);
  }

  /** Sources relevant to the selected countries (global sources always show). */
  visibleSources = computed(() => {
    const countries = this.countriesDraft();
    return this.registry().filter(
      (source) =>
        countries.length === 0 ||
        source.countries.includes('*') ||
        source.countries.some((code) => countries.includes(code)),
    );
  });

  sourceOptions = computed(() => {
    const t = this.t();

    if (!this.registryLoaded() || this.registry().length === 0) {
      return SOURCE_OPTIONS.map((option) => {
        const label = t[option.labelKey] ?? option.label;
        return {
          ...option,
          label: option.disabled ? `${label} (${t['source.unavailable']})` : label,
        };
      });
    }

    return [...this.visibleSources()]
      .sort(
        (a, b) =>
          Number(this.isRunnable(b)) - Number(this.isRunnable(a)) || a.name.localeCompare(b.name),
      )
      .map((source) => {
        const suffix = !this.hasTokenFor(source)
          ? ` (${t['sources.needsKey']})`
          : !this.isRunnable(source)
            ? ` (${t[`sources.status.${source.status}`] ?? source.status})`
            : '';
        return {
          value: source.id,
          label: `${source.name}${suffix}`,
          disabled: !this.isRunnable(source),
        };
      });
  });

  activeSourceCount = computed(
    () => this.sourceOptions().filter((option) => !option.disabled).length,
  );

  countryOptions = computed(() =>
    COUNTRY_OPTIONS.map((o) => ({ ...o, label: this.t()[o.labelKey] ?? o.label })),
  );

  constructor() {
    this.sourcesService.list().subscribe({
      next: (list) => {
        this.registry.set(list);
        this.registryLoaded.set(true);
      },
      error: () => this.registryLoaded.set(true),
    });

    effect(() => {
      const incoming = this.filters();
      const sources = untracked(() => this.sourcesDraft());
      const countries = untracked(() => this.countriesDraft());
      const remoteOnly = untracked(() => this.remoteOnlyDraft());
      const incomingRemoteOnly =
        incoming.remoteTypes.length === 1 && incoming.remoteTypes[0] === 'remote';

      if (!sameList(incoming.sources, sources)) this.sourcesDraft.set(incoming.sources);
      if (!sameList(incoming.countries, countries)) this.countriesDraft.set(incoming.countries);
      if (incomingRemoteOnly !== remoteOnly) this.remoteOnlyDraft.set(incomingRemoteOnly);
    });

    effect(() => {
      const incoming = this.query();
      const current = untracked(() => this.keywordsDraft());
      if (incoming !== current && incoming !== current.trim()) {
        this.keywordsDraft.set(incoming);
      }
    });
  }

  runScraper(): void {
    const remoteOnly = this.remoteOnlyDraft();
    const base = this.filters();
    this.run.emit({
      query: splitKeywords(this.keywordsDraft()).join(', '),
      filters: {
        ...base,
        sources: this.sourcesDraft(),
        countries: this.countriesDraft(),
        remoteTypes: remoteOnly ? ['remote'] : [],
      },
    });
  }

  /** Selects every source that can actually run for the current country set. */
  selectAllRecommended(): void {
    const selectable = this.sourceOptions()
      .filter((option) => !option.disabled)
      .map((option) => option.value);
    this.sourcesDraft.set(selectable);
  }

  sourceCountLabel(): string {
    return this.t()['scraper.activeSources'].replace('{n}', String(this.activeSourceCount()));
  }
}
