import type { OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../core/layout/header.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { MultiSelectComponent } from '../../shared/ui/multi-select/multi-select.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { SourcesService } from './data/sources.service';
import { COUNTRY_OPTIONS } from '../dashboard/data/dashboard.constants';
import type { CreateSource, JobSource, SourceType, SourceValidateResult } from '@shared';

type SourceStatusFilter = '' | 'active' | 'pending' | 'disabled' | 'broken';

interface SourceGroup {
  key: string;
  label: string;
  items: JobSource[];
}

@Component({
  selector: 'app-sources-page',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonComponent,
    MultiSelectComponent,
  ],
  template: `
    <div class="sources">
      <app-header />

      <main class="sources__shell">
        <header class="sources__intro">
          <div>
            <h1 class="sources__title">{{ t()['sources.title'] }}</h1>
            <p class="sources__subtitle">{{ t()['sources.subtitle'] }}</p>
          </div>
          <div class="sources__stats">
            <span class="sources__stat sources__stat--active">
              {{ counts().active }} {{ t()['sources.status.active'] }}
            </span>
            <span class="sources__stat"
              >{{ counts().pending }} {{ t()['sources.status.pending'] }}</span
            >
            <span class="sources__stat">{{ counts().total }} {{ t()['sources.total'] }}</span>
          </div>
        </header>

        @if (notice(); as text) {
          <div class="sources__notice" role="status">
            <span>{{ text }}</span>
            <button
              type="button"
              class="sources__notice-close"
              [attr.aria-label]="t()['sources.dismiss']"
              (click)="notice.set(null)"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  stroke-width="1.8"
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        }

        @if (error()) {
          <div class="sources__alert" role="alert">
            <span>{{ t()['sources.error'] }}</span>
            <button type="button" class="sources__retry" (click)="load()">
              {{ t()['sources.retry'] }}
            </button>
          </div>
        }

        <div class="sources__toolbar">
          <div
            class="sources__chips"
            role="group"
            [attr.aria-label]="t()['sources.filter.country']"
          >
            <button
              type="button"
              class="sources__chip"
              [class.sources__chip--on]="countryFilter() === ''"
              [attr.aria-pressed]="countryFilter() === ''"
              (click)="countryFilter.set('')"
            >
              {{ t()['sources.filter.allCountries'] }}
            </button>
            @for (country of countryChips(); track country.code) {
              <button
                type="button"
                class="sources__chip"
                [class.sources__chip--on]="countryFilter() === country.code"
                [attr.aria-pressed]="countryFilter() === country.code"
                (click)="countryFilter.set(country.code)"
              >
                {{ country.label }}
              </button>
            }
          </div>

          <div
            class="sources__chips sources__chips--status"
            role="group"
            [attr.aria-label]="t()['sources.filter.status']"
          >
            <button
              type="button"
              class="sources__chip"
              [class.sources__chip--on]="statusFilter() === ''"
              [attr.aria-pressed]="statusFilter() === ''"
              (click)="statusFilter.set('')"
            >
              {{ t()['sources.filter.allStatuses'] }}
            </button>
            @for (status of statusFilters; track status) {
              <button
                type="button"
                class="sources__chip"
                [class.sources__chip--on]="statusFilter() === status"
                [attr.aria-pressed]="statusFilter() === status"
                (click)="statusFilter.set(status)"
              >
                {{ statusLabel(status) }}
              </button>
            }
          </div>

          <app-button
            variant="primary"
            size="compact"
            (clicked)="formOpen.set(!formOpen())"
            [attr.aria-expanded]="formOpen()"
          >
            {{ formOpen() ? t()['sources.cancel'] : t()['sources.add'] }}
          </app-button>
        </div>

        @if (formOpen()) {
          <section class="sources__form" [attr.aria-label]="t()['sources.addTitle']">
            <h2 class="sources__form-title">{{ t()['sources.addTitle'] }}</h2>
            <p class="sources__form-hint">{{ t()['sources.form.hint'] }}</p>

            <div class="sources__form-grid">
              <label class="sources__field">
                <span>{{ t()['sources.form.name'] }}</span>
                <input
                  class="sources__input"
                  type="text"
                  autocomplete="off"
                  [placeholder]="t()['sources.form.namePlaceholder']"
                  [value]="formName()"
                  (input)="formName.set($any($event.target).value)"
                />
              </label>

              <label class="sources__field">
                <span>{{ t()['sources.form.baseUrl'] }}</span>
                <input
                  class="sources__input"
                  type="url"
                  autocomplete="off"
                  placeholder="https://jobs.example.com"
                  [value]="formBaseUrl()"
                  (input)="formBaseUrl.set($any($event.target).value)"
                />
              </label>

              <label class="sources__field">
                <span>{{ t()['sources.form.type'] }}</span>
                <select
                  class="sources__input"
                  [value]="formType()"
                  (change)="formType.set($any($event.target).value)"
                >
                  @for (type of typeOptions; track type) {
                    <option [value]="type">{{ typeLabel(type) }}</option>
                  }
                </select>
              </label>

              <div class="sources__field">
                <app-multi-select
                  [label]="t()['sources.form.countries']"
                  [options]="formCountryOptions()"
                  [selected]="formCountries()"
                  [placeholder]="t()['sources.filter.allCountries']"
                  [clearLabel]="t()['sources.clear']"
                  [emptyLabel]="t()['sources.filter.noCountries']"
                  (selectionChange)="formCountries.set($event)"
                />
              </div>
            </div>

            @if (formError()) {
              <p class="sources__form-error" role="alert">{{ formError() }}</p>
            }

            <div class="sources__form-actions">
              <app-button
                variant="primary"
                [loading]="saving()"
                (clicked)="submitForm()"
                [disabled]="!canSubmit()"
              >
                {{ t()['sources.form.submit'] }}
              </app-button>
              <app-button variant="ghost" (clicked)="formOpen.set(false)">
                {{ t()['sources.cancel'] }}
              </app-button>
            </div>
          </section>
        }

        @if (loading()) {
          <div class="sources__grid" aria-busy="true">
            @for (row of skeletons; track row) {
              <article class="source-card source-card--skeleton">
                <app-skeleton variant="text" width="55%" />
                <app-skeleton variant="text" width="90%" />
                <app-skeleton variant="text" width="70%" />
                <app-skeleton variant="text" width="40%" />
              </article>
            }
          </div>
        } @else if (groups().length === 0) {
          <app-empty-state
            [title]="t()['sources.empty.title']"
            [description]="t()['sources.empty.desc']"
          >
            <app-button variant="secondary" (clicked)="resetFilters()">
              {{ t()['sources.empty.reset'] }}
            </app-button>
          </app-empty-state>
        } @else {
          @for (group of groups(); track group.key) {
            <section class="sources__group">
              <h2 class="sources__group-title">
                {{ group.label }}
                <span class="sources__group-count">{{ group.items.length }}</span>
              </h2>

              <div class="sources__grid">
                @for (source of group.items; track source.id) {
                  <article class="source-card">
                    <div class="source-card__head">
                      <h3 class="source-card__name">{{ source.name }}</h3>
                      <app-badge [tone]="statusTone(source.status)" [withDot]="true">
                        {{ statusLabel(source.status) }}
                      </app-badge>
                    </div>

                    @if (source.requiresUserToken) {
                      <app-badge tone="info">{{ t()['sources.needsKey'] }}</app-badge>
                    }

                    <p class="source-card__desc">{{ source.description }}</p>

                    <div class="source-card__meta">
                      <app-badge tone="neutral">{{ typeLabel(source.type) }}</app-badge>
                      @if (source.remoteFriendly) {
                        <app-badge tone="primary">{{ t()['sources.remoteFriendly'] }}</app-badge>
                      }
                      @for (code of shownCountries(source); track code) {
                        <span class="source-card__country">{{ countryLabel(code) }}</span>
                      }
                      @if (extraCountries(source) > 0) {
                        <span class="source-card__country"> +{{ extraCountries(source) }} </span>
                      }
                    </div>

                    <footer class="source-card__foot">
                      <span class="source-card__health">
                        @if (source.health.lastSuccessAt; as last) {
                          {{ t()['sources.health.lastSuccess'] }} {{ last | date: 'short' }}
                        } @else {
                          {{ t()['sources.health.never'] }}
                        }
                        @if (source.health.failureCount > 0) {
                          <span class="source-card__failures">
                            · {{ source.health.failureCount }}
                            {{ t()['sources.health.failures'] }}
                          </span>
                        }
                      </span>
                      <app-button
                        variant="secondary"
                        size="compact"
                        [loading]="validatingId() === source.id"
                        (clicked)="validate(source)"
                      >
                        {{ t()['sources.validate'] }}
                      </app-button>
                    </footer>
                  </article>
                }
              </div>
            </section>
          }
        }
      </main>

      @if (preview(); as result) {
        <div class="sources__overlay" (click)="preview.set(null)">
          <div
            class="sources__modal"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="t()['sources.previewTitle']"
            (click)="$event.stopPropagation()"
          >
            <header class="sources__modal-head">
              <div>
                <h2 class="sources__modal-title">{{ t()['sources.previewTitle'] }}</h2>
                <app-badge [tone]="result.ok ? 'success' : 'danger'">
                  {{ result.ok ? t()['sources.validateOk'] : t()['sources.validateFail'] }}
                </app-badge>
              </div>
              <button
                type="button"
                class="sources__notice-close"
                [attr.aria-label]="t()['sources.close']"
                (click)="preview.set(null)"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    stroke-width="1.8"
                    fill="none"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </header>

            <p class="sources__modal-message">{{ result.message }}</p>

            <p class="sources__modal-meta">
              @if (result.latencyMs !== null) {
                <span>{{ result.latencyMs }} ms</span>
              }
              <span>{{ t()['sources.sampleCount'] }}: {{ result.sampleCount }}</span>
              <span>{{ t()['sources.status'] }}: {{ statusLabel(result.status) }}</span>
            </p>

            @if (result.preview.length > 0) {
              <ul class="sources__preview">
                @for (job of result.preview; track job.url) {
                  <li>
                    <a [href]="job.url" target="_blank" rel="noopener noreferrer">
                      {{ job.title }}
                    </a>
                    <span>{{ job.company }} · {{ job.location }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="sources__modal-empty">{{ t()['sources.previewEmpty'] }}</p>
            }

            <div class="sources__modal-actions">
              <app-button variant="secondary" (clicked)="preview.set(null)">
                {{ t()['sources.close'] }}
              </app-button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .sources {
        min-height: 100vh;
        background: var(--color-bg);
      }

      .sources__shell {
        max-width: var(--max-content-width);
        margin: 0 auto;
        padding: var(--spacing-6) var(--spacing-4) var(--spacing-8);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-5);
      }

      .sources__intro {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--spacing-3);
      }

      .sources__title {
        font-family: var(--font-heading);
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        margin: 0 0 var(--spacing-1);
      }

      .sources__subtitle {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      .sources__stats {
        display: flex;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .sources__stat {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-badge);
        padding: 4px var(--spacing-2);
        white-space: nowrap;
      }

      .sources__stat--active {
        color: var(--color-success);
        background: var(--color-success-soft);
        border-color: transparent;
        font-weight: var(--font-weight-semibold);
      }

      .sources__notice,
      .sources__alert {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-3);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-input);
        font-size: var(--text-sm);
      }

      .sources__notice {
        background: var(--color-info-soft);
        border: 1px solid var(--color-info);
        color: var(--color-info);
      }

      .sources__alert {
        background: var(--color-danger-soft);
        border: 1px solid var(--color-danger);
        color: var(--color-danger);
      }

      .sources__retry {
        background: transparent;
        border: 1px solid currentColor;
        color: inherit;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-input);
        padding: var(--spacing-1) var(--spacing-3);
        min-height: 36px;
        cursor: pointer;
      }

      .sources__notice-close {
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

      .sources__toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--spacing-3);
      }

      .sources__chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-2);
        min-width: 0;
      }

      .sources__chips--status {
        margin-left: auto;
      }

      .sources__chip {
        font-family: var(--font-body);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-badge);
        padding: 6px var(--spacing-3);
        min-height: 32px;
        cursor: pointer;
      }

      .sources__chip:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .sources__chip--on {
        background: var(--color-primary-soft);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      .sources__form {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
      }

      .sources__form-title {
        font-family: var(--font-heading);
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        margin: 0;
      }

      .sources__form-hint {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .sources__form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--spacing-3);
      }

      .sources__field {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
        min-width: 0;
      }

      .sources__input {
        width: 100%;
        height: 44px;
        padding: 0 var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text);
      }

      .sources__input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .sources__form-error {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-danger);
      }

      .sources__form-actions {
        display: flex;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .sources__group-title {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        font-family: var(--font-heading);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-muted);
        margin: 0 0 var(--spacing-3);
      }

      .sources__group-count {
        font-size: var(--text-xs);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-badge);
        padding: 1px var(--spacing-2);
      }

      .sources__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--spacing-4);
      }

      .source-card {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4);
        min-width: 0;
      }

      .source-card--skeleton {
        gap: var(--spacing-3);
        min-height: 150px;
      }

      .source-card__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-2);
      }

      .source-card__name {
        font-family: var(--font-heading);
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .source-card__desc {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--color-text-muted);
      }

      .source-card__meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--spacing-2);
      }

      .source-card__country {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-badge);
        padding: 2px var(--spacing-2);
      }

      .source-card__foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
        margin-top: auto;
        padding-top: var(--spacing-3);
        border-top: 1px solid var(--color-border);
      }

      .source-card__health {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .source-card__failures {
        color: var(--color-danger);
      }

      .sources__overlay {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: color-mix(in srgb, var(--color-bg) 70%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-4);
      }

      .sources__modal {
        width: min(560px, 100%);
        max-height: 80vh;
        overflow-y: auto;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        box-shadow: var(--elevation-light);
        padding: var(--spacing-4);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
      }

      .sources__modal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-2);
      }

      .sources__modal-head > div {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .sources__modal-title {
        font-family: var(--font-heading);
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        margin: 0;
      }

      .sources__modal-message {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text);
      }

      .sources__modal-meta {
        display: flex;
        gap: var(--spacing-3);
        flex-wrap: wrap;
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .sources__preview {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
      }

      .sources__preview li {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        font-size: var(--text-sm);
      }

      .sources__preview a {
        color: var(--color-primary);
        font-weight: var(--font-weight-medium);
        text-decoration: none;
        overflow-wrap: anywhere;
      }

      .sources__preview span {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .sources__modal-empty {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      .sources__modal-actions {
        display: flex;
        justify-content: flex-end;
      }

      @media (max-width: 768px) {
        .sources__shell {
          padding: var(--spacing-4) var(--spacing-4) var(--spacing-7);
        }

        .sources__title {
          font-size: var(--text-xl);
        }

        .sources__chips--status {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class SourcesPageComponent implements OnInit {
  private i18n = inject(I18nService);
  private sourcesService = inject(SourcesService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly sources = signal<JobSource[]>([]);
  readonly countryFilter = signal('');
  readonly statusFilter = signal<SourceStatusFilter>('');
  readonly validatingId = signal<string | null>(null);
  readonly preview = signal<SourceValidateResult | null>(null);
  readonly notice = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly formName = signal('');
  readonly formBaseUrl = signal('');
  readonly formType = signal<SourceType>('rss');
  readonly formCountries = signal<string[]>([]);
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly statusFilters: SourceStatusFilter[] = ['active', 'pending', 'disabled', 'broken'];
  readonly typeOptions: SourceType[] = ['rss', 'api', 'html', 'apify', 'ai_extract'];
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  t = computed(() => this.i18n.t());

  readonly formCountryOptions = computed(() =>
    COUNTRY_OPTIONS.map((option) => ({
      value: option.value,
      label: this.t()[option.labelKey] ?? option.label,
    })),
  );

  readonly counts = computed(() => {
    const list = this.sources();
    return {
      total: list.length,
      active: list.filter((source) => source.status === 'active').length,
      pending: list.filter((source) => source.status === 'pending').length,
    };
  });

  readonly countryChips = computed(() => {
    const codes = new Set<string>();
    for (const source of this.sources()) {
      for (const code of source.countries) {
        if (code !== '*') codes.add(code);
      }
    }
    return [
      { code: '*', label: this.t()['sources.group.global'] },
      ...[...codes]
        .sort((a, b) => this.countryLabel(a).localeCompare(this.countryLabel(b)))
        .map((code) => ({ code, label: this.countryLabel(code) })),
    ];
  });

  readonly groups = computed<SourceGroup[]>(() => {
    const country = this.countryFilter();
    const status = this.statusFilter();
    const buckets = new Map<string, JobSource[]>();

    for (const source of this.sources()) {
      if (country && !source.countries.includes(country)) continue;
      if (status && source.status !== status) continue;
      const key = source.countries.includes('*') ? '*' : (source.countries[0] ?? '*');
      const bucket = buckets.get(key);
      if (bucket) bucket.push(source);
      else buckets.set(key, [source]);
    }

    return [...buckets.entries()]
      .map(([key, items]) => ({
        key,
        label: key === '*' ? this.t()['sources.group.global'] : this.countryLabel(key),
        items,
      }))
      .sort((a, b) => {
        if (a.key === '*') return -1;
        if (b.key === '*') return 1;
        return a.label.localeCompare(b.label);
      });
  });

  readonly canSubmit = computed(
    () => this.formName().trim().length >= 2 && /^https?:\/\/.+/i.test(this.formBaseUrl().trim()),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.sourcesService.list().subscribe({
      next: (list) => {
        this.sources.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  validate(source: JobSource): void {
    this.validatingId.set(source.id);
    this.sourcesService.validate(source.id).subscribe({
      next: (result) => {
        this.validatingId.set(null);
        this.preview.set(result);
        this.load();
      },
      error: () => {
        this.validatingId.set(null);
        this.formError.set(this.t()['sources.validateFail']);
      },
    });
  }

  submitForm(): void {
    if (!this.canSubmit() || this.saving()) return;
    const payload: CreateSource = {
      name: this.formName().trim(),
      description: '',
      baseUrl: this.formBaseUrl().trim(),
      type: this.formType(),
      countries: this.formCountries(),
      categories: [],
      remoteFriendly: true,
      config: {},
    };

    this.saving.set(true);
    this.formError.set(null);
    this.sourcesService.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.formName.set('');
        this.formBaseUrl.set('');
        this.formCountries.set([]);
        this.notice.set(this.t()['sources.created']);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.message ?? this.t()['sources.error']);
      },
    });
  }

  resetFilters(): void {
    this.countryFilter.set('');
    this.statusFilter.set('');
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'broken':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  statusLabel(status: string): string {
    return this.t()[`sources.status.${status}`] ?? status;
  }

  typeLabel(type: string): string {
    return this.t()[`sources.type.${type}`] ?? type;
  }

  countryLabel(code: string): string {
    if (code === '*') return this.t()['sources.group.global'];
    return this.t()[`country.${code}`] ?? code.toUpperCase();
  }

  shownCountries(source: JobSource): string[] {
    if (source.countries.includes('*')) return [];
    return source.countries.slice(0, 3);
  }

  extraCountries(source: JobSource): number {
    return Math.max(0, source.countries.length - 3);
  }
}
