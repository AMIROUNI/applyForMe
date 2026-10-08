import type {
  ExtensionTaskAssignment,
  ExtensionTaskUpdate,
  IngestJobsRequest,
  IngestJobsResponse,
} from '@agency-apply/shared';
import { ApiError } from '../lib/api';
import { ExtractUnavailable } from '../lib/messages';
import {
  runTask,
  runTasks,
  type LoadResult,
  type RunnerDeps,
  type RunnerProgressEvent,
} from './runner';

const baseTask = (over: Partial<ExtensionTaskAssignment> = {}): ExtensionTaskAssignment => ({
  runId: 'run-1',
  taskId: 'task-1',
  source: 'indeed',
  status: 'pending',
  searchUrl: 'https://www.indeed.com/jobs?q=dev',
  keywords: ['dev'],
  countries: ['fr'],
  remoteOnly: false,
  ...over,
});

const item = (n: number) => ({
  title: `Job ${n}`,
  company: `Company ${n}`,
  location: 'Paris',
  url: `https://www.indeed.com/viewjob?jk=${n}`,
  description: '',
  skills: [],
});

const page = (
  count: number,
  nextUrl: string | null
): { kind: 'items'; items: ReturnType<typeof item>[]; nextUrl: string | null } => ({
  kind: 'items',
  items: Array.from({ length: count }, (_, index) => item(index + 1)),
  nextUrl,
});

interface Calls {
  updates: Array<{ taskId: string; update: ExtensionTaskUpdate }>;
  ingests: IngestJobsRequest[];
  opened: string[];
  navigated: string[];
  delays: number[];
  extracted: number;
  progress: RunnerProgressEvent[];
}

interface Options {
  extract?: (
    tabId: number,
    source: string
  ) => Promise<
    | ReturnType<typeof page>
    | { kind: 'blocked'; message: string }
    | { kind: 'error'; message: string }
  >;
  load?: () => LoadResult;
  stopped?: (calls: Calls) => boolean;
  listTasks?: () => Promise<ExtensionTaskAssignment[]>;
  updateFail?: (update: ExtensionTaskUpdate) => ApiError | null;
  ingestFail?: () => ApiError | null;
}

const makeDeps = (options: Options = {}): { deps: RunnerDeps; calls: Calls } => {
  const calls: Calls = {
    updates: [],
    ingests: [],
    opened: [],
    navigated: [],
    delays: [],
    extracted: 0,
    progress: [],
  };

  const deps: RunnerDeps = {
    api: {
      listTasks: async () => (options.listTasks ? options.listTasks() : [baseTask()]),
      updateTask: async (taskId: string, update: ExtensionTaskUpdate): Promise<unknown> => {
        const failure = options.updateFail?.(update);
        if (failure) throw failure;
        calls.updates.push({ taskId, update });
        return {};
      },
      ingestJobs: async (request: IngestJobsRequest): Promise<IngestJobsResponse> => {
        const failure = options.ingestFail?.();
        if (failure) throw failure;
        calls.ingests.push(request);
        return {
          ingested: request.items.length,
          found: request.items.length,
          taskStatus: 'running',
        };
      },
    },
    tabs: {
      open: async (url: string): Promise<number> => {
        calls.opened.push(url);
        return 7;
      },
      navigate: async (_tabId: number, url: string): Promise<void> => {
        calls.navigated.push(url);
      },
      waitForLoad: async (): Promise<LoadResult> => (options.load ? options.load() : {}),
    },
    extract: {
      extract: async (tabId: number, source: string) => {
        calls.extracted += 1;
        return options.extract ? options.extract(tabId, source) : page(0, null);
      },
    },
    delay: async (ms: number): Promise<void> => {
      calls.delays.push(ms);
    },
    rng: () => 0.5,
    isStopped: (): boolean => options.stopped?.(calls) ?? false,
    onProgress: event => calls.progress.push(event),
  };

  return { deps, calls };
};

const statuses = (calls: Calls): Array<string | undefined> =>
  calls.updates.map(entry => entry.update.status);

describe('runTask', () => {
  it('walks two pages, ingests items and finishes done', async () => {
    let loaded = 0;
    const { deps, calls } = makeDeps({
      extract: async () => {
        loaded += 1;
        return loaded === 1 ? page(2, 'https://www.indeed.com/jobs?q=dev&start=10') : page(1, null);
      },
    });

    const outcome = await runTask(baseTask({ remoteOnly: true, countries: ['tn'] }), deps);

    expect(outcome).toMatchObject({ status: 'done', pages: 2, items: 3, conflict: false });
    expect(outcome.message).toBe('');
    expect(calls.opened).toEqual(['https://www.indeed.com/jobs?q=dev']);
    expect(calls.navigated).toEqual(['https://www.indeed.com/jobs?q=dev&start=10']);
    expect(statuses(calls)).toEqual(['running', undefined, undefined, 'done']);
    expect(calls.updates[1].update).toMatchObject({ pagesCaptured: 1, itemsFound: 2 });
    expect(calls.ingests).toHaveLength(2);
    expect(calls.ingests[0]).toMatchObject({ runId: 'run-1', taskId: 'task-1' });
    expect(calls.ingests[0].items[0]).toMatchObject({ country: 'tn', remoteType: 'remote' });
    expect(calls.delays).toHaveLength(1);
    expect(calls.delays[0]).toBeGreaterThanOrEqual(2000);
    expect(calls.delays[0]).toBeLessThanOrEqual(5000);
    expect(calls.progress.some(event => event.type === 'page' && event.page === 2)).toBe(true);
  });

  it('stops at the three page cap even when more pages exist', async () => {
    const { deps, calls } = makeDeps({
      extract: async () => page(1, 'https://www.indeed.com/jobs?q=dev&start=999'),
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome).toMatchObject({ status: 'done', pages: 3, items: 3 });
    expect(outcome.message).toContain('3 pages');
    expect(calls.ingests).toHaveLength(3);
    expect(calls.navigated).toHaveLength(2);
    expect(calls.delays).toHaveLength(2);
    expect(statuses(calls).at(-1)).toBe('done');
  });

  it('cancels before opening a tab when the user already pressed stop', async () => {
    const { deps, calls } = makeDeps({ stopped: () => true });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome).toMatchObject({ status: 'cancelled', message: 'Stopped by you', pages: 0 });
    expect(calls.opened).toEqual([]);
    expect(calls.extracted).toBe(0);
    expect(statuses(calls)).toEqual(['running', 'cancelled']);
  });

  it('cancels mid-run without touching the next page', async () => {
    let stopped = false;
    const { deps, calls } = makeDeps({
      stopped: () => stopped,
      extract: async () => {
        stopped = true;
        return page(2, 'https://www.indeed.com/jobs?q=dev&start=10');
      },
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome).toMatchObject({ status: 'cancelled', pages: 1, items: 2 });
    expect(calls.navigated).toEqual([]);
    expect(calls.ingests).toHaveLength(1);
    expect(statuses(calls)).toEqual(['running', undefined, 'cancelled']);
  });

  it('reports HTTP 403 as blocked without extracting', async () => {
    const { deps, calls } = makeDeps({ load: () => ({ httpStatus: 403 }) });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome).toMatchObject({ status: 'blocked' });
    expect(outcome.message).toContain('403');
    expect(calls.extracted).toBe(0);
    expect(calls.ingests).toEqual([]);
    expect(statuses(calls)).toEqual(['running', 'blocked']);
  });

  it('reports HTTP 500 as failed, not blocked', async () => {
    const { deps, calls } = makeDeps({ load: () => ({ httpStatus: 503 }) });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('503');
    expect(statuses(calls)).toEqual(['running', 'failed']);
  });

  it('stops when the page reports a login wall', async () => {
    const { deps, calls } = makeDeps({
      extract: async () => ({ kind: 'blocked', message: 'Login wall at www.linkedin.com' }),
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome).toMatchObject({
      status: 'blocked',
      message: 'Login wall at www.linkedin.com',
    });
    expect(calls.ingests).toEqual([]);
    expect(statuses(calls)).toEqual(['running', 'blocked']);
  });

  it('finishes quietly when the first page has no results', async () => {
    const { deps, calls } = makeDeps({ extract: async () => page(0, null) });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome).toMatchObject({ status: 'done', pages: 1, items: 0 });
    expect(outcome.message).toBe('No results found');
    expect(calls.ingests).toEqual([]);
    expect(statuses(calls)).toEqual(['running', undefined, 'done']);
  });

  it('resumes a task that was already running from a previous session', async () => {
    const { deps, calls } = makeDeps({
      updateFail: update =>
        update.status === 'running' ? new ApiError(409, 'TASK_STATE_INVALID', 'nope') : null,
      listTasks: async () => [baseTask({ status: 'running' })],
      extract: async () => page(1, null),
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.status).toBe('done');
    expect(calls.updates[0].update.pagesCaptured).toBe(1);
    expect(statuses(calls).includes('running')).toBe(false);
  });

  it('gives up without patching when the task vanished from the server', async () => {
    const { deps, calls } = makeDeps({
      updateFail: update =>
        update.status === 'running' ? new ApiError(409, 'TASK_STATE_INVALID', 'nope') : null,
      listTasks: async () => [],
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.conflict).toBe(true);
    expect(calls.updates).toEqual([]);
    expect(calls.extracted).toBe(0);
  });

  it('turns a mid-run conflict into a conflict outcome, not a failure', async () => {
    const { deps, calls } = makeDeps({
      extract: async () => page(1, null),
      updateFail: update =>
        update.pagesCaptured !== undefined ? new ApiError(409, 'TASK_STATE_INVALID', 'nope') : null,
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.conflict).toBe(true);
    expect(statuses(calls)).toEqual(['running']);
  });

  it('turns an ingest conflict into a conflict outcome', async () => {
    const { deps, calls } = makeDeps({
      extract: async () => page(1, null),
      ingestFail: () => new ApiError(409, 'TASK_NOT_RUNNING', 'cancelled'),
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.conflict).toBe(true);
    expect(calls.updates.every(entry => entry.update.status !== 'failed')).toBe(true);
  });

  it('fails unsupported sources before opening anything', async () => {
    const { deps, calls } = makeDeps();

    const outcome = await runTask(baseTask({ source: 'current_page' }), deps);

    expect(outcome.status).toBe('failed');
    expect(calls.opened).toEqual([]);
    expect(calls.extracted).toBe(0);
    expect(statuses(calls)).toEqual(['failed']);
  });

  it('rejects a search URL on the wrong host', async () => {
    const { deps, calls } = makeDeps();

    const outcome = await runTask(
      baseTask({ searchUrl: 'https://evil.example.com/jobs?q=dev' }),
      deps
    );

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('unexpected site');
    expect(calls.opened).toEqual([]);
  });

  it('fails when the page never loads', async () => {
    const { deps } = makeDeps({ load: () => ({ timedOut: true }) });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('did not load');
  });

  it('fails when the content script cannot be reached', async () => {
    const { deps } = makeDeps({
      extract: async () => {
        throw new ExtractUnavailable();
      },
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toBe('Could not read the page');
  });

  it('reports a rejected token clearly', async () => {
    const { deps } = makeDeps({
      updateFail: update =>
        update.status === 'running'
          ? new ApiError(401, 'EXTENSION_TOKEN_INVALID', 'bad token')
          : null,
      listTasks: async () => [baseTask()],
    });

    const outcome = await runTask(baseTask(), deps);

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('reconnect');
  });
});

describe('runTasks', () => {
  it('runs tasks sequentially and cancels the rest once stopped', async () => {
    const second = baseTask({
      taskId: 'task-2',
      searchUrl: 'https://www.linkedin.com/jobs/search',
    });
    const { deps, calls } = makeDeps({
      listTasks: async () => [baseTask(), second],
      stopped: current => current.updates.some(entry => entry.update.status === 'done'),
      extract: async () => page(1, null),
    });

    const outcomes = await runTasks([baseTask(), second], deps);

    expect(outcomes.map(outcome => outcome.status)).toEqual(['done', 'cancelled']);
    expect(calls.ingests).toHaveLength(1);
    expect(calls.ingests[0].taskId).toBe('task-1');
    const cancelled = calls.updates.find(entry => entry.taskId === 'task-2');
    expect(cancelled?.update.status).toBe('cancelled');
    expect(calls.delays).toHaveLength(1);
  });
});
