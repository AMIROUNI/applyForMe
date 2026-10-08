import {
  ingestJobsRequestSchema,
  type ExtensionTaskAssignment,
  type ExtensionTaskStatus,
  type ExtensionTaskUpdate,
  type IngestJobsRequest,
  type IngestJobsResponse,
} from '@agency-apply/shared';
import { ApiError } from '../lib/api';
import { detectBlocked } from '../lib/blocked';
import { isKnownSource, isSupportedSearchUrl } from '../lib/hosts';
import { MAX_INGEST_ITEMS, PAGE_CAP, randomDelayMs } from '../lib/limits';
import { ExtractUnavailable, type ExtractResponse } from '../lib/messages';

export interface LoadResult {
  httpStatus?: number;
  timedOut?: boolean;
}

export interface RunnerApi {
  listTasks(): Promise<ExtensionTaskAssignment[]>;
  updateTask(taskId: string, update: ExtensionTaskUpdate): Promise<unknown>;
  ingestJobs(request: IngestJobsRequest): Promise<IngestJobsResponse>;
}

export interface TabsPort {
  open(url: string): Promise<number>;
  navigate(tabId: number, url: string): Promise<void>;
  waitForLoad(tabId: number): Promise<LoadResult>;
}

export interface ExtractPort {
  extract(tabId: number, source: string): Promise<ExtractResponse>;
}

export type RunnerProgressEvent =
  | { type: 'task'; taskId: string; status: ExtensionTaskStatus; message: string }
  | { type: 'page'; taskId: string; page: number; items: number; total: number }
  | { type: 'ingest'; taskId: string; added: number; total: number };

export interface RunnerDeps {
  api: RunnerApi;
  tabs: TabsPort;
  extract: ExtractPort;
  delay(ms: number): Promise<void>;
  rng(): number;
  isStopped(): boolean;
  onProgress?: (event: RunnerProgressEvent) => void;
}

export interface RunContext {
  tabId: number | null;
}

export interface TaskOutcome {
  status: 'done' | 'blocked' | 'failed' | 'cancelled';
  message: string;
  pages: number;
  items: number;
  conflict: boolean;
}

class ConflictSignal extends Error {
  constructor() {
    super('Task state changed on the server');
    this.name = 'ConflictSignal';
  }
}

const emit = (deps: RunnerDeps, event: RunnerProgressEvent): void => {
  deps.onProgress?.(event);
};

const isConflict = (error: unknown): boolean => error instanceof ApiError && error.status === 409;

const safeUpdate = async (
  deps: RunnerDeps,
  taskId: string,
  update: ExtensionTaskUpdate
): Promise<void> => {
  try {
    await deps.api.updateTask(taskId, update);
  } catch (error) {
    if (isConflict(error)) throw new ConflictSignal();
    throw error;
  }
};

const terminal = async (
  deps: RunnerDeps,
  taskId: string,
  update: ExtensionTaskUpdate
): Promise<boolean> => {
  try {
    await deps.api.updateTask(taskId, update);
    return true;
  } catch {
    return false;
  }
};

const enrich = (
  items: IngestJobsRequest['items'],
  task: ExtensionTaskAssignment
): IngestJobsRequest['items'] =>
  items.map(item => ({
    ...item,
    country: item.country ?? task.countries[0],
    remoteType: item.remoteType ?? (task.remoteOnly ? 'remote' : undefined),
  }));

export const runTask = async (
  task: ExtensionTaskAssignment,
  deps: RunnerDeps,
  ctx: RunContext = { tabId: null }
): Promise<TaskOutcome> => {
  const outcome: TaskOutcome = {
    status: 'failed',
    message: '',
    pages: 0,
    items: 0,
    conflict: false,
  };

  const fail = async (message: string): Promise<TaskOutcome> => {
    outcome.status = 'failed';
    outcome.message = message;
    await terminal(deps, task.taskId, {
      status: 'failed',
      message,
      pagesCaptured: outcome.pages,
      itemsFound: outcome.items,
    });
    emit(deps, { type: 'task', taskId: task.taskId, status: 'failed', message });
    return outcome;
  };

  if (!isKnownSource(task.source)) {
    return fail('This source is not supported by the extension');
  }
  if (!isSupportedSearchUrl(task.source, task.searchUrl)) {
    return fail('The search link points at an unexpected site');
  }

  try {
    try {
      await safeUpdate(deps, task.taskId, { status: 'running' });
    } catch (error) {
      if (!(error instanceof ConflictSignal)) throw error;
      const known = await deps.api.listTasks();
      if (!known.some(candidate => candidate.taskId === task.taskId)) {
        outcome.conflict = true;
        outcome.status = 'cancelled';
        outcome.message = 'The task is no longer available';
        return outcome;
      }
    }
    emit(deps, { type: 'task', taskId: task.taskId, status: 'running', message: '' });

    let targetUrl = task.searchUrl;
    let page = 0;
    let pageCapReached = false;

    while (page < PAGE_CAP) {
      if (deps.isStopped()) {
        outcome.status = 'cancelled';
        outcome.message = 'Stopped by you';
        await terminal(deps, task.taskId, {
          status: 'cancelled',
          message: outcome.message,
          pagesCaptured: outcome.pages,
          itemsFound: outcome.items,
        });
        emit(deps, {
          type: 'task',
          taskId: task.taskId,
          status: 'cancelled',
          message: outcome.message,
        });
        return outcome;
      }

      if (ctx.tabId === null) ctx.tabId = await deps.tabs.open(targetUrl);
      else await deps.tabs.navigate(ctx.tabId, targetUrl);

      const load = await deps.tabs.waitForLoad(ctx.tabId);
      if (deps.isStopped()) {
        outcome.status = 'cancelled';
        outcome.message = 'Stopped by you';
        await terminal(deps, task.taskId, {
          status: 'cancelled',
          message: outcome.message,
          pagesCaptured: outcome.pages,
          itemsFound: outcome.items,
        });
        emit(deps, {
          type: 'task',
          taskId: task.taskId,
          status: 'cancelled',
          message: outcome.message,
        });
        return outcome;
      }
      if (load.timedOut) return fail('The page did not load in time');
      if (load.httpStatus !== undefined && load.httpStatus >= 500) {
        return fail(`The site returned an error (HTTP ${load.httpStatus})`);
      }
      const earlyBlock = detectBlocked({ url: '', httpStatus: load.httpStatus });
      if (earlyBlock) {
        outcome.status = 'blocked';
        outcome.message = earlyBlock.message;
        await terminal(deps, task.taskId, {
          status: 'blocked',
          message: outcome.message,
          pagesCaptured: outcome.pages,
          itemsFound: outcome.items,
        });
        emit(deps, {
          type: 'task',
          taskId: task.taskId,
          status: 'blocked',
          message: outcome.message,
        });
        return outcome;
      }

      const response = await deps.extract.extract(ctx.tabId, task.source);
      if (response.kind === 'blocked') {
        outcome.status = 'blocked';
        outcome.message = response.message;
        await terminal(deps, task.taskId, {
          status: 'blocked',
          message: outcome.message,
          pagesCaptured: outcome.pages,
          itemsFound: outcome.items,
        });
        emit(deps, {
          type: 'task',
          taskId: task.taskId,
          status: 'blocked',
          message: outcome.message,
        });
        return outcome;
      }
      if (response.kind === 'error') {
        return fail(response.message || 'Could not read the page');
      }

      const batch = enrich(response.items.slice(0, MAX_INGEST_ITEMS), task);
      if (batch.length > 0) {
        const request = ingestJobsRequestSchema.parse({
          runId: task.runId,
          taskId: task.taskId,
          items: batch,
        } satisfies IngestJobsRequest);
        try {
          await deps.api.ingestJobs(request);
        } catch (error) {
          if (isConflict(error)) throw new ConflictSignal();
          throw error;
        }
        outcome.items += batch.length;
        emit(deps, {
          type: 'ingest',
          taskId: task.taskId,
          added: batch.length,
          total: outcome.items,
        });
      }

      page += 1;
      outcome.pages = page;
      await safeUpdate(deps, task.taskId, {
        pagesCaptured: outcome.pages,
        itemsFound: outcome.items,
      });
      emit(deps, {
        type: 'page',
        taskId: task.taskId,
        page,
        items: batch.length,
        total: outcome.items,
      });

      if (response.items.length === 0 && page === 1) {
        outcome.status = 'done';
        outcome.message = 'No results found';
        break;
      }
      if (!response.nextUrl) break;
      if (page === PAGE_CAP) {
        pageCapReached = true;
        break;
      }
      targetUrl = response.nextUrl;
      await deps.delay(randomDelayMs(deps.rng));
    }

    outcome.status = 'done';
    outcome.message = pageCapReached
      ? 'Stopped after 3 pages (limit reached)'
      : outcome.items === 0
        ? 'No results found'
        : '';
    await terminal(deps, task.taskId, {
      status: 'done',
      message: outcome.message,
      pagesCaptured: outcome.pages,
      itemsFound: outcome.items,
    });
    emit(deps, { type: 'task', taskId: task.taskId, status: 'done', message: outcome.message });
    return outcome;
  } catch (error) {
    if (error instanceof ConflictSignal) {
      outcome.conflict = true;
      outcome.status = 'cancelled';
      outcome.message = 'The task changed on the server';
      emit(deps, {
        type: 'task',
        taskId: task.taskId,
        status: 'cancelled',
        message: outcome.message,
      });
      return outcome;
    }
    if (error instanceof ExtractUnavailable) {
      return fail(error.message);
    }
    if (error instanceof ApiError) {
      return fail(
        error.status === 401
          ? 'The extension token was rejected — reconnect the panel'
          : error.message
      );
    }
    return fail(error instanceof Error ? error.message : 'The extension hit an unexpected error');
  }
};

export const runTasks = async (
  tasks: ExtensionTaskAssignment[],
  deps: RunnerDeps
): Promise<TaskOutcome[]> => {
  const ctx: RunContext = { tabId: null };
  const outcomes: TaskOutcome[] = [];
  let first = true;

  for (const task of tasks) {
    if (!first) await deps.delay(randomDelayMs(deps.rng));
    first = false;

    if (deps.isStopped()) {
      const message = 'Stopped by you';
      try {
        await deps.api.updateTask(task.taskId, { status: 'cancelled', message });
      } catch {
        // A 409 here means someone else already finished or cancelled the task.
      }
      outcomes.push({ status: 'cancelled', message, pages: 0, items: 0, conflict: false });
      emit(deps, { type: 'task', taskId: task.taskId, status: 'cancelled', message });
      continue;
    }

    outcomes.push(await runTask(task, deps, ctx));
  }
  return outcomes;
};
