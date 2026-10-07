import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadGatewayException } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { clearRobotsCache } from '../scraper/robots';
import type { DiscoveryProposal } from '@agency-apply/shared';

type Row = Record<string, unknown> & { save?: jest.Mock };

const makeDoc = (row: Row): Row & { save: jest.Mock } => ({
  ...row,
  save: jest.fn().mockResolvedValue(undefined),
});

const matches = (doc: Row, filter: Record<string, unknown>): boolean =>
  Object.entries(filter).every(([key, value]) => doc[key] === value);

const makeModel = () => {
  const rows: Array<Row & { save: jest.Mock }> = [];
  return {
    rows,
    find: jest.fn((filter: Record<string, unknown> = {}) => ({
      exec: async () => rows.filter(row => matches(row, filter)),
    })),
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

const response = (body: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

const ROBOTS = 'User-agent: *\nAllow: /\n';
const rssFixture = readFileSync(
  join(__dirname, '..', 'scraper', 'adapters', 'fixtures', 'generic.rss'),
  'utf8'
);
const jsonLdFixture = readFileSync(
  join(__dirname, '..', 'scraper', 'adapters', 'fixtures', 'generic-jsonld.html'),
  'utf8'
);

const rssProposal: DiscoveryProposal = {
  name: 'Remote Feed',
  baseUrl: 'https://feed.example.com',
  type: 'rss',
  why: 'Public RSS feed',
  feedUrls: ['https://feed.example.com/jobs.xml'],
};

describe('DiscoveryService', () => {
  let model: ReturnType<typeof makeModel>;
  let llm: { proposeSources: jest.Mock };
  let service: DiscoveryService;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearRobotsCache();
    model = makeModel();
    llm = { proposeSources: jest.fn() };
    service = new DiscoveryService(model as never, llm as never);
    fetchMock = jest.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) return response(ROBOTS);
      if (url.includes('feed.example.com')) return response(rssFixture);
      if (url.includes('jobs-board.example.org')) return response(jsonLdFixture);
      return response('not found', 404);
    });
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearRobotsCache();
  });

  it('adds a passing candidate as a pending source with a preview', async () => {
    llm.proposeSources.mockResolvedValue([rssProposal]);

    const result = await service.discover('user-1', { country: 'fr', keywords: [] });

    expect(result.country).toBe('fr');
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];
    expect(candidate).toMatchObject({
      name: 'Remote Feed',
      ok: true,
      sourceId: 'remote-feed',
      sampleCount: 3,
    });
    expect(candidate?.preview).toHaveLength(3);

    const created = model.rows.find(row => row.id === 'remote-feed');
    expect(created).toMatchObject({
      status: 'pending',
      addedBy: 'ai',
      ownerId: 'user-1',
      countries: ['fr'],
      type: 'rss',
      requiresUserToken: false,
    });
    expect(created?.config).toEqual({ feedUrls: ['https://feed.example.com/jobs.xml'] });

    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.endsWith('/robots.txt'))).toBe(true);
    expect(urls).toContain('https://feed.example.com/jobs.xml');
    expect(urls.some(url => url.includes('169.254'))).toBe(false);
  });

  it('rejects unsafe, duplicate, unparseable and adapter-less candidates', async () => {
    model.rows.push(makeDoc({ id: 'remotive', baseUrl: 'https://www.remotive.com' }));
    llm.proposeSources.mockResolvedValue([
      { name: 'Metadata Leak', baseUrl: 'http://169.254.169.254/latest', type: 'html' },
      { name: 'Remotive Mirror', baseUrl: 'https://www.remotive.com/jobs', type: 'html' },
      { name: 'Thin Board', baseUrl: 'https://jobs-board.example.org', type: 'html' },
      { name: 'Api Without Endpoint', baseUrl: 'https://api-board.example.org', type: 'api' },
    ]);

    const result = await service.discover('user-1', { country: 'fr', keywords: [] });

    expect(result.candidates.map(candidate => candidate.ok)).toEqual([false, false, false, false]);
    expect(result.candidates[0]?.reason).toContain('not allowed');
    expect(result.candidates[1]).toMatchObject({
      reason: 'Already in the registry',
      sourceId: 'remotive',
    });
    expect(result.candidates[2]?.reason).toContain('Only 2 parseable');
    expect(result.candidates[2]?.sampleCount).toBe(2);
    expect(result.candidates[3]?.reason).toContain('No API endpoint');

    expect(model.rows).toHaveLength(1);
    expect(model.create).not.toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.includes('169.254'))).toBe(false);
    expect(urls.some(url => url.includes('www.remotive.com'))).toBe(false);
    expect(urls).not.toContain('https://api-board.example.org');
  });

  it('returns an empty result when the model proposes nothing', async () => {
    llm.proposeSources.mockResolvedValue([]);

    const result = await service.discover('user-1', { country: 'tn', keywords: ['dev'] });

    expect(result).toEqual({ country: 'tn', candidates: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  it('propagates LLM failures', async () => {
    llm.proposeSources.mockRejectedValue(
      new BadGatewayException({ statusCode: 502, code: 'AI_DISCOVERY_FAILED', message: 'down' })
    );

    await expect(service.discover('user-1', { country: 'fr', keywords: [] })).rejects.toThrow(
      BadGatewayException
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
