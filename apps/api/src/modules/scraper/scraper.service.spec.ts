import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { DEFAULT_SOURCES, adapterById, type RegistrySource } from './adapters';
import type { SourceAdapter } from './scraper.types';

const runStart = (sources: string[]) => ({
  sources,
  keywords: [],
  countries: [],
  remoteOnly: false,
});

const EXTENSION_BASE: Record<string, string> = {
  linkedin_jobs: 'https://www.linkedin.com/jobs',
  linkedin_posts: 'https://www.linkedin.com/search/results/content/',
  indeed: 'https://www.indeed.com',
};

const registrySource = (id: string): RegistrySource => ({
  id,
  name: id,
  baseUrl: '',
  type: 'api',
  remoteFriendly: true,
  config: { adapterId: id },
  requiresUserToken: false,
  executionMode: 'server',
  requiresExtension: false,
});

/** Mirrors SourcesService.resolve() against the in-memory adapter map. */
const resolveSources = (ids: string[]) => {
  const requested = ids.length ? ids : DEFAULT_SOURCES;
  const usable: RegistrySource[] = [];
  const extension: RegistrySource[] = [];
  const rejected: Array<{ source: string; reason: string }> = [];
  for (const id of requested) {
    if (EXTENSION_BASE[id]) {
      extension.push({
        ...registrySource(id),
        name: id,
        baseUrl: EXTENSION_BASE[id],
        type: 'html',
        config: {},
        executionMode: 'extension',
        requiresExtension: true,
      });
      continue;
    }
    if (adapterById.has(id)) {
      usable.push(registrySource(id));
    } else {
      rejected.push({ source: id, reason: 'Unknown source' });
    }
  }
  return { usable, extension, rejected };
};

type RunDoc = {
  _id: string;
  userId: string;
  status: string;
  sources: string[];
  keywords: string[];
  countries: string[];
  remoteOnly: boolean;
  progress: { total: number; done: number; found: number };
  errors: Array<{ source: string; message: string }>;
  extensionTasks: Array<{
    id: string;
    source: string;
    status: string;
    searchUrl: string;
    pagesCaptured: number;
    itemsFound: number;
    message: string;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>;
  startedAt: Date | null;
  finishedAt: Date | null;
  save: jest.Mock;
};

describe('ScraperService', () => {
  let service: ScraperService;
  let runModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };
  let jobModel: { bulkWrite: jest.Mock };
  let sourcesService: { resolve: jest.Mock; recordOutcome: jest.Mock };
  let runDoc: RunDoc;
  const originalAdapters = new Map(
    DEFAULT_SOURCES.map(id => [id, adapterById.get(id) as SourceAdapter])
  );
  const originalRemotive = adapterById.get('remotive') as SourceAdapter;

  beforeEach(() => {
    runDoc = {
      _id: 'run-1',
      userId: 'user-1',
      status: 'queued',
      sources: ['remotive'],
      keywords: ['react'],
      countries: [],
      remoteOnly: false,
      progress: { total: 1, done: 0, found: 0 },
      errors: [],
      extensionTasks: [],
      startedAt: null,
      finishedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    runModel = {
      findOne: jest.fn((filter: Record<string, unknown> = {}) => {
        const taskId = filter['extensionTasks.id'];
        if (typeof taskId === 'string') {
          const found = runDoc.extensionTasks.some(task => task.id === taskId) ? runDoc : null;
          return { exec: jest.fn().mockResolvedValue(found) };
        }
        return { exec: jest.fn().mockResolvedValue(null) };
      }),
      find: jest.fn((filter: Record<string, unknown> = {}) => {
        const status = filter.status as { $in?: string[] } | undefined;
        const matchesUser = filter.userId === undefined || runDoc.userId === filter.userId;
        const matchesStatus = !status?.$in || status.$in.includes(runDoc.status);
        return { exec: jest.fn().mockResolvedValue(matchesUser && matchesStatus ? [runDoc] : []) };
      }),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(runDoc) }),
      create: jest.fn().mockImplementation(async (data: Record<string, unknown>) => {
        Object.assign(runDoc, data);
        return { _id: 'run-1', ...data };
      }),
    };
    jobModel = { bulkWrite: jest.fn().mockResolvedValue({}) };
    sourcesService = {
      resolve: jest.fn().mockImplementation((ids: string[]) => resolveSources(ids)),
      recordOutcome: jest.fn().mockResolvedValue(undefined),
    };
    service = new ScraperService(runModel as never, jobModel as never, sourcesService as never);
  });

  afterEach(() => {
    for (const id of DEFAULT_SOURCES) {
      const original = originalAdapters.get(id);
      if (original) adapterById.set(id, original);
    }
  });

  const waitFor = async (predicate: () => boolean, timeoutMs = 10_000): Promise<void> => {
    const started = Date.now();
    while (!predicate() && Date.now() - started < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(predicate()).toBe(true);
  };

  const settle = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 900));
  };

  const waitForStatus = async (status: string, timeoutMs = 10_000): Promise<void> => {
    await waitFor(() => runDoc.status === status, timeoutMs);
  };

  it('rejects runs where no requested source is supported', async () => {
    await expect(service.startRun('user-1', runStart(['linkedin', 'nope']))).rejects.toThrow(
      BadRequestException
    );
  });

  it('rejects when a run is already active', async () => {
    runModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'existing' }),
    });
    await expect(service.startRun('user-1', runStart(['remotive']))).rejects.toThrow(
      ConflictException
    );
  });

  it('creates a run with all sources by default', async () => {
    for (const id of DEFAULT_SOURCES) {
      adapterById.set(id, { id, name: id, scrape: jest.fn().mockResolvedValue([]) });
    }
    const run = await service.startRun('user-1', runStart([]));
    expect(runModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: DEFAULT_SOURCES,
        progress: { total: 4, done: 0, found: 0 },
      })
    );
    expect(run.status).toBe('queued');
    await waitForStatus('done');
  });

  it('persists scraped jobs with scores and updates progress', async () => {
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockResolvedValue([
        {
          sourceId: 'remotive',
          sourceName: 'Remotive',
          title: 'React Developer',
          company: 'Acme',
          location: 'Worldwide',
          country: '',
          description: 'Build apps',
          url: 'https://example.com/j/1',
          postedAt: new Date('2026-10-01'),
          remoteType: 'remote',
          jobType: 'full-time',
          experienceLevel: 'mid',
          skills: ['react'],
          salary: null,
          applyMethod: 'external',
        },
      ]),
    });

    await service.startRun('user-1', { ...runStart(['remotive']), keywords: ['react'] });
    await waitForStatus('done');

    expect(runDoc.progress).toEqual({ total: 1, done: 1, found: 1 });
    expect(runDoc.errors).toEqual([]);
    expect(runDoc.finishedAt).toBeInstanceOf(Date);

    const operations = jobModel.bulkWrite.mock.calls[0][0] as Array<{
      updateOne: {
        filter: Record<string, unknown>;
        update: Record<string, unknown>;
        upsert: boolean;
      };
    }>;
    expect(operations).toHaveLength(1);
    expect(operations[0].updateOne.filter).toMatchObject({ userId: 'user-1' });
    expect(operations[0].updateOne.upsert).toBe(true);
    const update = operations[0].updateOne.update as {
      $set: Record<string, unknown>;
      $setOnInsert: Record<string, unknown>;
    };
    expect(update.$set.matchScore).toBe(99);
    expect(update.$set.matchReason).toBe('Matches keyword: react');
    expect(update.$setOnInsert).toEqual({ status: 'new' });
  });

  it('records per-source failures without aborting the run', async () => {
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockRejectedValue(new Error('HTTP 503 for feed')),
    });

    await service.startRun('user-1', runStart(['remotive']));
    await waitForStatus('failed');

    expect(runDoc.errors).toEqual([{ source: 'remotive', message: 'HTTP 503 for feed' }]);
    expect(runDoc.progress).toEqual({ total: 1, done: 1, found: 0 });
    expect(jobModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('hides runs belonging to another user', async () => {
    await expect(service.getRun('someone-else', 'run-1')).rejects.toThrow(NotFoundException);
    const run = await service.getRun('user-1', 'run-1');
    expect(run.id).toBe('run-1');
  });

  it('queues a browser task per extension source and keeps the run open', async () => {
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockResolvedValue([]),
    });

    const run = await service.startRun('user-1', runStart(['remotive', 'linkedin_jobs']));

    expect(run.sources).toEqual(['remotive', 'linkedin_jobs']);
    expect(run.progress).toEqual({ total: 2, done: 0, found: 0 });
    expect(run.extensionTasks).toHaveLength(1);
    expect(run.extensionTasks[0]).toMatchObject({
      source: 'linkedin_jobs',
      status: 'pending',
      searchUrl: expect.stringContaining('https://www.linkedin.com/jobs/search'),
      message: '',
      startedAt: null,
      finishedAt: null,
    });

    await waitFor(() => runDoc.progress.done >= 1);
    await settle();
    expect(runDoc.status).toBe('running');
    expect(runDoc.finishedAt).toBeNull();
  });

  it('finishes the run once every browser task is terminal', async () => {
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockResolvedValue([]),
    });
    await service.startRun('user-1', runStart(['remotive', 'linkedin_jobs']));
    await waitFor(() => runDoc.progress.done >= 1);
    await settle();

    const taskId = runDoc.extensionTasks[0].id as string;
    const result = await service.updateTaskByUser('user-1', 'run-1', taskId, 'skip');

    expect(result.extensionTasks[0]).toMatchObject({
      status: 'skipped',
      finishedAt: expect.any(Date),
    });
    expect(result.status).toBe('done');
    expect(result.progress).toEqual({ total: 2, done: 2, found: 0 });
    expect(result.finishedAt).toBeInstanceOf(Date);
  });

  it('runs an extension-only flow: pick up, ingest, then mark done', async () => {
    await service.startRun('user-1', { ...runStart(['linkedin_jobs']), keywords: ['react'] });
    await waitForStatus('running');
    const taskId = runDoc.extensionTasks[0].id as string;

    const running = await service.updateTaskByExtension('user-1', taskId, { status: 'running' });
    expect(running.extensionTasks[0]).toMatchObject({ status: 'running' });
    expect(running.status).toBe('running');
    expect(runDoc.progress.done).toBe(0);

    const ingest = await service.ingestJobs('user-1', {
      taskId,
      items: [
        {
          title: 'Angular Engineer',
          company: 'Acme',
          url: 'https://www.linkedin.com/jobs/view/123',
          location: 'Remote',
          country: 'us',
          description: 'Build dashboards',
          skills: ['angular'],
        },
      ],
    });
    expect(ingest).toEqual({ ingested: 1, found: 1, taskStatus: 'running' });
    expect(runDoc.progress).toEqual({ total: 1, done: 0, found: 1 });
    expect(jobModel.bulkWrite).toHaveBeenCalledTimes(1);

    const done = await service.updateTaskByExtension('user-1', taskId, {
      status: 'done',
      pagesCaptured: 3,
    });
    expect(done.status).toBe('done');
    expect(done.extensionTasks[0]).toMatchObject({ status: 'done', pagesCaptured: 3 });
    expect(done.progress).toEqual({ total: 1, done: 1, found: 1 });
    expect(done.finishedAt).toBeInstanceOf(Date);
  });

  it('starts the browser task automatically on the first ingested batch', async () => {
    await service.startRun('user-1', runStart(['linkedin_jobs']));
    await waitForStatus('running');
    const taskId = runDoc.extensionTasks[0].id as string;

    const ingest = await service.ingestJobs('user-1', {
      taskId,
      items: [
        {
          title: 'Node Developer',
          company: 'Acme',
          url: 'https://www.indeed.com/viewjob?jk=1',
          location: 'Remote',
        },
      ],
    });
    expect(ingest.taskStatus).toBe('running');
    expect((runDoc.extensionTasks[0] as { status: string }).status).toBe('running');
  });

  it('refuses ingests for a task that is not collecting', async () => {
    await service.startRun('user-1', runStart(['linkedin_jobs']));
    await waitForStatus('running');
    const taskId = runDoc.extensionTasks[0].id as string;
    await service.updateTaskByExtension('user-1', taskId, { status: 'blocked' });

    await expect(
      service.ingestJobs('user-1', {
        taskId,
        items: [{ title: 'Too late', url: 'https://example.com/j/1' }],
      })
    ).rejects.toThrow(ConflictException);
  });

  it('refuses another user extension token and unknown tasks', async () => {
    await service.startRun('user-1', runStart(['linkedin_jobs']));
    await waitForStatus('running');
    const taskId = runDoc.extensionTasks[0].id as string;

    await expect(
      service.updateTaskByExtension('someone-else', taskId, { status: 'running' })
    ).rejects.toThrow(NotFoundException);
    await expect(service.ingestJobs('someone-else', { taskId, items: [] })).rejects.toThrow(
      NotFoundException
    );
    await expect(
      service.updateTaskByExtension('user-1', 'nope', { status: 'running' })
    ).rejects.toThrow(NotFoundException);
  });

  it('reopens a failed run when the user retries a blocked task', async () => {
    await service.startRun('user-1', runStart(['linkedin_jobs']));
    await waitForStatus('running');
    const taskId = runDoc.extensionTasks[0].id as string;

    await service.updateTaskByExtension('user-1', taskId, { status: 'blocked' });
    expect(runDoc.status).toBe('failed');
    expect(runDoc.progress.done).toBe(1);

    const retried = await service.updateTaskByUser('user-1', 'run-1', taskId, 'retry');
    expect(retried.status).toBe('running');
    expect(retried.progress.done).toBe(0);
    expect(retried.extensionTasks[0]).toMatchObject({ status: 'running', finishedAt: null });
    expect(retried.finishedAt).toBeNull();
  });

  it('refuses actions the state machine does not allow', async () => {
    await service.startRun('user-1', runStart(['linkedin_jobs']));
    await waitForStatus('running');
    const taskId = runDoc.extensionTasks[0].id as string;
    await service.updateTaskByExtension('user-1', taskId, { status: 'running' });
    await service.updateTaskByExtension('user-1', taskId, { status: 'done' });

    await expect(service.updateTaskByUser('user-1', 'run-1', taskId, 'retry')).rejects.toThrow(
      ConflictException
    );
    await expect(
      service.updateTaskByExtension('user-1', taskId, { status: 'pending' })
    ).rejects.toThrow(ConflictException);
  });

  it('skips tasks nobody picks up within ten minutes', async () => {
    await service.startRun('user-1', runStart(['linkedin_jobs']));
    await waitForStatus('running');
    runDoc.startedAt = new Date(Date.now() - 11 * 60 * 1000);

    await service.sweepStaleTasks();

    expect(runDoc.extensionTasks[0]).toMatchObject({
      status: 'skipped',
      message: 'No browser activity within 10 minutes',
      finishedAt: expect.any(Date),
    });
    expect(runDoc.progress).toEqual({ total: 1, done: 1, found: 0 });
    expect(runDoc.status).toBe('done');
  });

  it('fails a browser task that stops reporting for ten minutes', async () => {
    await service.startRun('user-1', runStart(['linkedin_jobs']));
    await waitForStatus('running');
    const taskId = runDoc.extensionTasks[0].id as string;
    await service.updateTaskByExtension('user-1', taskId, { status: 'running' });
    (runDoc.extensionTasks[0] as { startedAt: Date | null }).startedAt = new Date(
      Date.now() - 11 * 60 * 1000
    );

    await service.sweepStaleTasks();

    expect(runDoc.extensionTasks[0]).toMatchObject({
      status: 'failed',
      message: 'No browser activity for 10 minutes',
    });
    expect(runDoc.status).toBe('failed');
  });

  it('only hands out tasks that belong to the caller', async () => {
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockResolvedValue([]),
    });
    await service.startRun('user-1', runStart(['remotive', 'linkedin_jobs']));
    await waitFor(() => runDoc.progress.done >= 1);
    await settle();

    const tasks = await service.listExtensionTasks('user-1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      runId: 'run-1',
      source: 'linkedin_jobs',
      status: 'pending',
      keywords: [],
      remoteOnly: false,
      searchUrl: expect.stringContaining('linkedin.com'),
    });
    expect(await service.listExtensionTasks('someone-else')).toEqual([]);
  });
});
