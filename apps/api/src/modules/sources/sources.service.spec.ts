import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { SOURCE_SEED } from './seed/source-seed.data';
import { adapterById } from '../scraper/adapters';
import type { SourceAdapter } from '../scraper/scraper.types';

type Row = Record<string, unknown> & { save?: jest.Mock };

const makeDoc = (row: Row): Row & { save: jest.Mock } => ({
  ...row,
  save: jest.fn().mockResolvedValue(undefined),
});

const matches = (doc: Row, filter: Record<string, unknown>): boolean =>
  Object.entries(filter).every(([key, value]) => {
    const actual = doc[key] as unknown;
    if (value && typeof value === 'object' && '$in' in (value as Record<string, unknown>)) {
      const list = (value as { $in: unknown[] }).$in;
      if (Array.isArray(actual)) return actual.some(item => list.includes(item));
      return list.includes(actual);
    }
    return actual === value;
  });

interface FindChain {
  sort(order?: unknown): FindChain;
  exec(): Promise<Row[]>;
}

const makeModel = () => {
  const rows: Array<Row & { save: jest.Mock }> = [];
  return {
    rows,
    countDocuments: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(rows.length) })),
    insertMany: jest.fn((docs: Row[]) => {
      docs.forEach(row => rows.push(makeDoc(row)));
      return Promise.resolve(undefined);
    }),
    find: jest.fn((filter: Record<string, unknown> = {}) => {
      const found = rows.filter(row => matches(row, filter));
      const chain: FindChain = {
        sort: () => chain,
        exec: async () => found,
      };
      return chain;
    }),
    findOne: jest.fn((filter: Record<string, unknown>) => ({
      exec: jest.fn().mockResolvedValue(rows.find(row => matches(row, filter)) ?? null),
    })),
    create: jest.fn(async (data: Row) => {
      const doc = makeDoc(data);
      rows.push(doc);
      return doc;
    }),
  };
};

const seedModel = async (model: ReturnType<typeof makeModel>): Promise<void> => {
  await model.insertMany(SOURCE_SEED.map(seed => ({ ...seed, ownerId: null })));
};

describe('SourcesService', () => {
  let model: ReturnType<typeof makeModel>;
  let service: SourcesService;
  const originalRemotive = adapterById.get('remotive') as SourceAdapter;

  beforeEach(() => {
    model = makeModel();
    service = new SourcesService(model as never);
  });

  afterEach(() => {
    adapterById.set('remotive', originalRemotive);
  });

  const jobs = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      sourceId: 'remotive',
      sourceName: 'Remotive',
      title: `React Developer ${index}`,
      company: 'Acme',
      location: 'Remote',
      country: '',
      description: 'Build apps',
      url: `https://example.com/j/${index}`,
      postedAt: new Date('2026-10-01'),
      remoteType: 'remote',
      jobType: 'full-time',
      experienceLevel: 'mid',
      skills: ['react'],
      salary: null,
      applyMethod: 'external',
    }));

  it('seeds the registry only when it is empty', async () => {
    await service.ensureSeeded();
    expect(model.insertMany).toHaveBeenCalledTimes(1);
    expect(model.rows).toHaveLength(SOURCE_SEED.length);

    await service.ensureSeeded();
    expect(model.insertMany).toHaveBeenCalledTimes(1);
  });

  it('lists sources filtered by country, type and status', async () => {
    await seedModel(model);

    const tunisia = await service.list({ country: 'tn' });
    const tunisiaIds = tunisia.map(source => source.id);
    expect(tunisiaIds).toEqual(
      expect.arrayContaining(['emploi-nat-tn', 'tanitjobs', 'keepjob', 'remotive'])
    );
    expect(tunisiaIds).not.toContain('reed');
    expect(tunisiaIds).not.toContain('wuzzuf');

    const apify = await service.list({ type: 'apify' });
    expect(apify.every(source => source.type === 'apify')).toBe(true);
    expect(apify.some(source => source.id === 'linkedin')).toBe(true);

    const active = await service.list({ status: 'active' });
    expect(active.map(source => source.id).sort()).toEqual([
      'arbeitnow',
      'remoteok',
      'remotive',
      'weworkremotely',
    ]);
  });

  it('resolves active sources with an adapter and rejects everything else', async () => {
    await seedModel(model);

    const { usable, rejected } = await service.resolve([
      'remotive',
      'linkedin',
      'tanitjobs',
      'nope',
    ]);

    expect(usable.map(source => source.id)).toEqual(['remotive']);
    expect(rejected).toEqual([
      { source: 'linkedin', reason: 'Connect the provider API key to enable this source' },
      { source: 'tanitjobs', reason: 'Source is disabled' },
      { source: 'nope', reason: 'Unknown source' },
    ]);
  });

  it('defaults to every active source when the run picks none', async () => {
    await seedModel(model);

    const { usable } = await service.resolve([]);
    expect(usable.map(source => source.id)).toEqual([
      'remotive',
      'remoteok',
      'arbeitnow',
      'weworkremotely',
    ]);
  });

  it('falls back to the legacy adapter map when the registry is empty', async () => {
    const { usable, rejected } = await service.resolve(['remotive', 'unknown']);

    expect(usable).toEqual([
      {
        id: 'remotive',
        name: 'Remotive',
        baseUrl: '',
        type: 'api',
        remoteFriendly: true,
        config: { adapterId: 'remotive' },
        requiresUserToken: false,
      },
    ]);
    expect(rejected).toEqual([{ source: 'unknown', reason: 'Unknown source' }]);
  });

  it('rejects unsafe URLs when adding a custom source', async () => {
    await expect(
      service.create('user-1', {
        name: 'Localhost jobs',
        description: '',
        baseUrl: 'http://localhost:3000/jobs',
        type: 'html',
        countries: [],
        categories: [],
        remoteFriendly: true,
        config: {},
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a pending, user-owned source with a unique slug', async () => {
    const first = await service.create('user-1', {
      name: 'My Job Board',
      description: 'Custom board',
      baseUrl: 'https://jobs.example.com',
      type: 'rss',
      countries: ['tn'],
      categories: ['tech'],
      remoteFriendly: true,
      config: { feedUrls: ['https://jobs.example.com/feed.xml'] },
    });
    expect(first).toMatchObject({
      id: 'my-job-board',
      status: 'pending',
      addedBy: 'user',
      ownerId: 'user-1',
      health: { failureCount: 0, avgLatencyMs: null },
    });

    await service.create('user-2', {
      name: 'My Job Board',
      description: '',
      baseUrl: 'https://other.example.com',
      type: 'html',
      countries: [],
      categories: [],
      remoteFriendly: false,
      config: {},
    });
    expect((await service.get('my-job-board-2')).ownerId).toBe('user-2');
  });

  it('only lets the owner edit a custom source and blocks system sources', async () => {
    await seedModel(model);

    await expect(service.patch('user-1', 'remotive', { name: 'Hacked' })).rejects.toThrow(
      ForbiddenException
    );

    const custom = await service.create('user-1', {
      name: 'Board',
      description: '',
      baseUrl: 'https://board.example.com',
      type: 'html',
      countries: [],
      categories: [],
      remoteFriendly: true,
      config: {},
    });
    await expect(service.patch('user-2', custom.id, { name: 'Nope' })).rejects.toThrow(
      ForbiddenException
    );

    const updated = await service.patch('user-1', custom.id, { name: 'Board renamed' });
    expect(updated.name).toBe('Board renamed');

    await expect(service.patch('user-1', 'does-not-exist', {})).rejects.toThrow(NotFoundException);
  });

  it('validates a source through its adapter, previews jobs and activates it', async () => {
    await seedModel(model);
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockResolvedValue(jobs(5)),
    });

    const result = await service.validate('user-1', 'remotive');

    expect(result).toMatchObject({
      id: 'remotive',
      ok: true,
      reachable: true,
      runnable: true,
      sampleCount: 5,
      preview: [
        expect.objectContaining({ title: 'React Developer 0', company: 'Acme' }),
        expect.objectContaining({ title: 'React Developer 1' }),
        expect.objectContaining({ title: 'React Developer 2' }),
      ],
      status: 'active',
    });
    expect(result.preview).toHaveLength(3);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(model.rows.find(row => row.id === 'remotive')?.health).toMatchObject({
      failureCount: 0,
      lastSuccessAt: expect.any(Date),
    });
  });

  it('activates a pending source once validation returns enough jobs', async () => {
    await seedModel(model);
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockResolvedValue(jobs(3)),
    });
    const pending = model.rows.find(row => row.id === 'remotive');
    if (pending) pending.status = 'pending';

    const result = await service.validate('user-1', 'remotive');

    expect(result.status).toBe('active');
    expect(pending?.status).toBe('active');
  });

  it('reports failures and increments the failure counter', async () => {
    await seedModel(model);
    adapterById.set('remotive', {
      ...originalRemotive,
      scrape: jest.fn().mockRejectedValue(new Error('HTTP 503 for feed')),
    });

    const result = await service.validate('user-1', 'remotive');

    expect(result).toMatchObject({
      ok: false,
      reachable: false,
      runnable: true,
      message: 'HTTP 503 for feed',
      preview: [],
    });
    expect(model.rows.find(row => row.id === 'remotive')?.health).toMatchObject({
      failureCount: 1,
      lastErrorAt: expect.any(Date),
    });
  });

  it('probes reachability without an adapter and keeps the source pending', async () => {
    await seedModel(model);
    const row = model.rows.find(entry => entry.id === 'glassdoor');
    const baseUrl = String(row?.baseUrl);
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html></html>'),
    }) as never;

    try {
      const result = await service.validate('user-1', 'glassdoor');
      expect(result).toMatchObject({
        ok: true,
        reachable: true,
        runnable: false,
        sampleCount: 0,
        status: 'pending',
      });
      expect(result.message).toContain('apify');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(new URL(baseUrl).hostname),
        expect.anything()
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('runs a pending html source through the generic adapter and activates it', async () => {
    await seedModel(model);
    const postings = Array.from({ length: 3 }, (_, index) => ({
      '@type': 'JobPosting',
      title: `Frontend Engineer ${index}`,
      description: 'Build accessible dashboards with Angular.',
      datePosted: '2026-10-01',
      hiringOrganization: { '@type': 'Organization', name: `Studio ${index}` },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: 'Paris', addressCountry: 'FR' },
      },
      url: `https://wuzzuf.net/jobs/frontend-engineer-${index}`,
    }));
    const page = `<html><head><script type="application/ld+json">${JSON.stringify(
      postings
    )}</script></head><body></body></html>`;

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: unknown) => ({
      ok: true,
      text: async () => (String(url).includes('robots.txt') ? '' : page),
    })) as never;

    try {
      const result = await service.validate('user-1', 'wuzzuf');
      expect(result).toMatchObject({
        ok: true,
        runnable: true,
        sampleCount: 3,
        status: 'active',
      });
      expect(result.preview.map(job => job.company)).toEqual(['Studio 0', 'Studio 1', 'Studio 2']);
      expect(model.rows.find(row => row.id === 'wuzzuf')?.status).toBe('active');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('records health outcomes without throwing when the source disappeared', async () => {
    await seedModel(model);
    await expect(service.recordOutcome('remotive', true, 120)).resolves.toBeUndefined();
    expect(model.rows.find(row => row.id === 'remotive')?.health).toMatchObject({
      failureCount: 0,
      avgLatencyMs: 120,
    });
    await expect(service.recordOutcome('ghost', false, 10)).resolves.toBeUndefined();
  });
});
