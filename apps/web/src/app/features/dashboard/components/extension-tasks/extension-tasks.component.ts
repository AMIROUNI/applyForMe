import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExtensionTaskAction, ExtensionTaskStatus, ScraperRun } from '@shared';
import { BadgeComponent, type BadgeTone } from '../../../../shared/ui/badge/badge.component';
import { I18nService } from '../../../../core/i18n/i18n.service';

const ALLOWED_ACTIONS: Record<ExtensionTaskStatus, ExtensionTaskAction[]> = {
  pending: ['skip', 'cancel'],
  running: ['skip', 'cancel'],
  blocked: ['retry', 'cancel'],
  failed: ['retry', 'cancel'],
  skipped: ['retry', 'cancel'],
  done: [],
  cancelled: [],
};

const STATUS_TONES: Record<ExtensionTaskStatus, BadgeTone> = {
  pending: 'neutral',
  running: 'info',
  done: 'success',
  blocked: 'warning',
  failed: 'danger',
  skipped: 'neutral',
  cancelled: 'neutral',
};

const SOURCE_LABEL_KEYS: Record<string, string> = {
  linkedin_jobs: 'source.linkedinJobs',
  linkedin_posts: 'source.linkedinPosts',
  indeed: 'source.indeed',
};

const TERMINAL: ExtensionTaskStatus[] = ['done', 'blocked', 'failed', 'skipped', 'cancelled'];

@Component({
  selector: 'app-extension-tasks',
  standalone: true,
  imports: [CommonModule, BadgeComponent],
  template: `
    <section class="tasks" [attr.aria-label]="t()['extension.tasks.title']">
      <header class="tasks__head">
        <span class="tasks__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <rect
              x="3"
              y="4"
              width="18"
              height="14"
              rx="2"
              stroke="currentColor"
              stroke-width="1.8"
            />
            <path d="M8 21h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            <path
              d="M9.5 9.5l2 2 3-3.5"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <div class="tasks__head-text">
          <h2 class="tasks__title">{{ t()['extension.tasks.title'] }}</h2>
          <p class="tasks__count">{{ finishedCount() }} / {{ run().extensionTasks.length }}</p>
        </div>
      </header>

      @if (browserHint()) {
        <p class="tasks__hint" role="status">{{ t()['extension.tasks.hint'] }}</p>
      }

      @if (error(); as err) {
        <p class="tasks__error" role="alert">{{ errorLabel(err) }}</p>
      }

      <ul class="tasks__list">
        @for (task of run().extensionTasks; track task.id) {
          <li class="task">
            <div class="task__row">
              <span class="task__source">{{ sourceLabel(task.source) }}</span>
              <app-badge [tone]="statusTone(task.status)">{{ statusLabel(task.status) }}</app-badge>
            </div>

            <a
              class="task__url"
              [href]="task.searchUrl"
              target="_blank"
              rel="noopener noreferrer"
              [attr.title]="task.searchUrl"
            >
              {{ task.searchUrl }}
            </a>

            <p class="task__meta">
              <span>{{ pagesLabel(task.pagesCaptured) }}</span>
              <span>{{ itemsLabel(task.itemsFound) }}</span>
            </p>

            @if (task.message && task.status !== 'done') {
              <p class="task__message">{{ task.message }}</p>
            }

            @if (actionsFor(task.status).length > 0) {
              <div class="task__actions">
                @for (act of actionsFor(task.status); track act) {
                  <button
                    type="button"
                    class="task__action"
                    [class.task__action--danger]="act === 'cancel'"
                    [disabled]="pendingId() !== null"
                    (click)="emitAction(task.id, act)"
                  >
                    {{ actionLabel(act) }}
                  </button>
                }
              </div>
            }
          </li>
        }
      </ul>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .tasks {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4);
      }

      .tasks__head {
        display: flex;
        gap: var(--spacing-3);
        align-items: flex-start;
      }

      .tasks__mark {
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

      .tasks__head-text {
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .tasks__title {
        font-family: var(--font-heading);
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text);
      }

      .tasks__count {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .tasks__hint {
        margin: 0;
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--color-info-soft);
        border: 1px solid var(--color-info);
        border-radius: var(--radius-input);
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--color-info);
      }

      .tasks__error {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-danger);
      }

      .tasks__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
      }

      .task {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
        padding: var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        min-width: 0;
      }

      .task__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
      }

      .task__source {
        font-family: var(--font-heading);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .task__url {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .task__url:hover {
        color: var(--color-primary);
        text-decoration: underline;
      }

      .task__meta {
        display: flex;
        gap: var(--spacing-3);
        flex-wrap: wrap;
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .task__message {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--color-warning);
        overflow-wrap: anywhere;
      }

      .task__actions {
        display: flex;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .task__action {
        font-family: var(--font-body);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
        padding: var(--spacing-1) var(--spacing-3);
        min-height: 32px;
        cursor: pointer;
      }

      .task__action:hover:not(:disabled) {
        border-color: var(--color-primary);
      }

      .task__action:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-focus-ring);
      }

      .task__action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .task__action--danger {
        color: var(--color-danger);
      }

      .task__action--danger:hover:not(:disabled) {
        border-color: var(--color-danger);
      }
    `,
  ],
})
export class ExtensionTasksComponent {
  private i18n = inject(I18nService);

  run = input.required<ScraperRun>();
  pendingId = input<string | null>(null);
  error = input<string | null>(null);

  action = output<{ taskId: string; action: ExtensionTaskAction }>();

  t = computed(() => this.i18n.t());

  readonly finishedCount = computed(
    () => this.run().extensionTasks.filter((task) => TERMINAL.includes(task.status)).length,
  );

  /** Any task still waiting for (or inside) the browser means: open the panel. */
  readonly browserHint = computed(() =>
    this.run().extensionTasks.some(
      (task) => task.status === 'pending' || task.status === 'running',
    ),
  );

  actionsFor(status: ExtensionTaskStatus): ExtensionTaskAction[] {
    return ALLOWED_ACTIONS[status] ?? [];
  }

  statusTone(status: ExtensionTaskStatus): BadgeTone {
    return STATUS_TONES[status] ?? 'neutral';
  }

  statusLabel(status: ExtensionTaskStatus): string {
    return this.t()[`extension.tasks.status.${status}`] ?? status;
  }

  sourceLabel(source: string): string {
    const key = SOURCE_LABEL_KEYS[source];
    return (key && this.t()[key]) || source;
  }

  actionLabel(action: ExtensionTaskAction): string {
    return this.t()[`extension.tasks.action.${action}`] ?? action;
  }

  /** Error keys are translated when known; anything else passes through. */
  errorLabel(key: string): string {
    const value = this.t()[key];
    return value ? value : key;
  }

  pagesLabel(pages: number): string {
    return this.t()['extension.tasks.pages'].replace('{n}', String(pages));
  }

  itemsLabel(items: number): string {
    return this.t()['extension.tasks.items'].replace('{n}', String(items));
  }

  emitAction(taskId: string, action: ExtensionTaskAction): void {
    if (this.pendingId() !== null) return;
    this.action.emit({ taskId, action });
  }
}
