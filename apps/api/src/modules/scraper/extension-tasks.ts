import type { ExtensionTask, ExtensionTaskStatus, ExtensionTaskUpdate } from '@agency-apply/shared';
import { isTerminalExtensionTaskStatus } from '@agency-apply/shared';

export interface TaskLike {
  id: string;
  source: string;
  status: ExtensionTaskStatus;
  searchUrl: string;
  pagesCaptured: number;
  itemsFound: number;
  message: string;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
}

const ALLOWED_TRANSITIONS: Record<ExtensionTaskStatus, ExtensionTaskStatus[]> = {
  pending: ['running', 'blocked', 'failed', 'skipped', 'cancelled'],
  running: ['done', 'blocked', 'failed', 'skipped', 'cancelled'],
  blocked: ['running', 'cancelled'],
  failed: ['running', 'cancelled'],
  skipped: ['running', 'cancelled'],
  done: [],
  cancelled: [],
};

const DEFAULT_MESSAGES: Partial<Record<ExtensionTaskStatus, string>> = {
  done: 'Captured in your browser',
  blocked: 'Stopped by a login wall, CAPTCHA or rate limit',
  failed: 'The browser extension reported a failure',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export const taskSnapshot = (task: TaskLike): ExtensionTask => ({
  id: task.id,
  source: task.source,
  status: task.status,
  searchUrl: task.searchUrl,
  pagesCaptured: task.pagesCaptured,
  itemsFound: task.itemsFound,
  message: task.message,
  startedAt: task.startedAt,
  finishedAt: task.finishedAt,
});

export const canTransitionExtensionTask = (
  from: ExtensionTaskStatus,
  to: ExtensionTaskStatus
): boolean => ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;

export const isTerminalTask = (status: ExtensionTaskStatus): boolean =>
  isTerminalExtensionTaskStatus(status);

export const areTasksTerminal = (tasks: readonly TaskLike[]): boolean =>
  tasks.every(task => isTerminalTask(task.status));

export const terminalisesTask = (from: ExtensionTaskStatus, to: ExtensionTaskStatus): boolean =>
  !isTerminalTask(from) && isTerminalTask(to);

export interface TaskTransition {
  ok: boolean;
  task: ExtensionTask;
  reason?: string;
  becameTerminal?: boolean;
}

export const applyTaskUpdate = (
  task: TaskLike,
  update: ExtensionTaskUpdate,
  now: Date = new Date()
): TaskTransition => {
  const target = update.status;
  if (target && !canTransitionExtensionTask(task.status, target)) {
    return {
      ok: false,
      task: taskSnapshot(task),
      reason: `Cannot move a ${task.status} task to ${target}`,
    };
  }

  const retried = target === 'running' && isTerminalTask(task.status);
  const next = taskSnapshot(task);
  if (target) next.status = target;
  if (update.pagesCaptured !== undefined) next.pagesCaptured = update.pagesCaptured;
  if (update.itemsFound !== undefined) next.itemsFound = update.itemsFound;
  if (update.message !== undefined) next.message = update.message;

  if (next.status === 'running') {
    next.startedAt = task.startedAt ?? now;
    if (retried) {
      next.startedAt = now;
      next.pagesCaptured = 0;
      next.finishedAt = null;
      next.message = '';
    }
  }

  const becameTerminal = terminalisesTask(task.status, next.status);
  if (becameTerminal) {
    next.finishedAt = now;
    if (!next.message) next.message = DEFAULT_MESSAGES[next.status] ?? '';
  }

  return { ok: true, task: next, becameTerminal };
};
