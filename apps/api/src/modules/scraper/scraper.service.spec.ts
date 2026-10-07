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

const registrySource = (id: string): RegistrySource => ({
  id,
  name: id,
  baseUrl: '',
  type: 'api',
  remoteFriendly: true,
  config: { adapterId: id },
  requiresUserToken: false,
});

/** Mirrors SourcesService.resolve() against the in-memory adapter map. */
const resolveSources = (ids: string[]) => {
  const requested = ids.length ? ids : DEFAULT_SOURCES;
  return {
    usable: requested.filter(id => adapterById.has(id)).map(registrySource),
    rejected: requested
      .filter(id => !adapterById.has(id))
      .map(source => ({ source, reason: 'Unknown source' })),
  };
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
  let runDoc: Record<string, unknown> & { save: jest.Mock };
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
      startedAt: null,
      finishedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    runModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(runDoc) }),
      create: jest.fn().mockImplementation(async (data: Record<string, unknown>) => ({
        _id: 'run-1',
        ...data,
      })),
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

  const waitForStatus = async (status: string, timeoutMs = 10_000): Promise<void> => {
    const started = Date.now();
    while (runDoc.status !== status && Date.now() - started < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(runDoc.status).toBe(status);
  };

  it('rejects runs where no requested source is supported', async () => {
    await expect(service.startRun('user-1', runStart(['linkedin', 'indeed']))).rejects.toThrow(
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
});
