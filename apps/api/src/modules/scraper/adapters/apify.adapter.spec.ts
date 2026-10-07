import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apifyActorPath, buildApifyInput, createApifyAdapter } from './apify.adapter';
import type { RegistrySource, ScrapeParams } from '../scraper.types';

const fixture = readFileSync(join(__dirname, 'fixtures', 'apify-dataset.json'), 'utf8');

const noFilter: ScrapeParams = { keywords: [], countries: [], remoteOnly: false };

const source = (overrides: Partial<RegistrySource> = {}): RegistrySource => ({
  id: 'linkedin',
  name: 'LinkedIn Jobs',
  baseUrl: 'https://www.linkedin.com/jobs',
  type: 'apify',
  remoteFriendly: true,
  config: { apifyActorId: 'apify/linkedin-jobs-scraper' },
  requiresUserToken: true,
  ...overrides,
});

describe('apify adapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes the actor id to the documented ~ form', () => {
    expect(apifyActorPath('apify/linkedin-jobs-scraper')).toBe('apify~linkedin-jobs-scraper');
    expect(apifyActorPath(' apify~already-there ')).toBe('apify~already-there');
  });

  it('runs the actor with a Bearer header, item cap and keyword queries', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => fixture });
    global.fetch = fetchMock as never;

    const adapter = createApifyAdapter(source(), 'apify_api_SECRET-4242');
    const jobs = await adapter.scrape({
      keywords: ['react', 'remote', 'node'],
      countries: [],
      remoteOnly: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      'https://api.apify.com/v2/actors/apify~linkedin-jobs-scraper/run-sync-get-dataset-items'
    );
    expect(url).toContain('format=json');
    expect(url).toContain('limit=50');
    expect(url).not.toContain('apify_api_SECRET-4242');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer apify_api_SECRET-4242'
    );
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body['queries']).toBe('react\nremote\nnode');
    expect(body['query']).toBe('react');
    expect(body['maxItems']).toBe(50);
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      sourceId: 'linkedin',
      sourceName: 'LinkedIn Jobs',
      title: 'React Developer',
      company: 'Nimbus Labs',
      url: 'https://www.linkedin.com/jobs/view/3900000001',
      country: 'fr',
    });
    expect(jobs[2]).toMatchObject({ title: 'Node.js Backend Developer', country: 'tn' });
    expect(jobs.every(job => job.applyMethod === 'external')).toBe(true);
  });

  it('stays capped and quiet when there are no keywords', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => fixture });
    global.fetch = fetchMock as never;

    const jobs = await createApifyAdapter(source(), 'tok').scrape(noFilter);

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ maxItems: 50 });
    expect(jobs).toHaveLength(3);
  });

  it('merges inputTemplate without letting keywords clobber it', () => {
    const input = buildApifyInput(
      source({
        config: { apifyActorId: 'apify/x', inputTemplate: { queries: 'kept', location: 'Paris' } },
      }),
      { ...noFilter, keywords: ['react'] }
    );
    expect(input).toMatchObject({
      queries: 'kept',
      location: 'Paris',
      query: 'react',
      maxItems: 50,
    });
  });

  it('fails fast when the source has no actor id', async () => {
    const adapter = createApifyAdapter(source({ config: {} }), 'tok');
    await expect(adapter.scrape(noFilter)).rejects.toThrow('No apifyActorId');
  });
});
