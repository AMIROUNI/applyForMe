import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RegistrySource, ScrapeParams } from '../scraper.types';
import { resolveAdapter, unavailableReason } from './index';
import {
  parseGenericHtml,
  parseJsonLdJobs,
  parseSelectorJobs,
  parseHeuristicJobs,
} from './generic-html.adapter';
import { parseGenericFeed, feedCandidates } from './generic-rss.adapter';
import { parseApiPayload } from './generic-api.adapter';

const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const noFilter: ScrapeParams = { keywords: [], countries: [], remoteOnly: false };

const source = (overrides: Partial<RegistrySource> = {}): RegistrySource => ({
  id: 'test-source',
  name: 'Test Source',
  baseUrl: 'https://jobs.example.com',
  type: 'html',
  remoteFriendly: false,
  config: {},
  requiresUserToken: false,
  ...overrides,
});

describe('generic html adapter — JSON-LD', () => {
  const html = fixture('generic-jsonld.html');
  const src = source({ id: 'wuzzuf', name: 'Wuzzuf' });

  it('extracts JobPosting nodes and ignores other schema types', () => {
    const jobs = parseJsonLdJobs(html, src, noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceId: 'wuzzuf',
      title: 'Senior React Developer',
      company: 'Acme Corp',
      remoteType: 'remote',
      jobType: 'all',
      url: 'https://jobs.example.com/acme/senior-react-developer',
    });
    expect(jobs[0].salary).toEqual({ min: 80000, max: 110000, currency: 'USD', period: 'year' });
    expect(jobs[0].description).toContain('React');
    expect(jobs[0].description).not.toContain('<p>');
    expect(jobs[1]).toMatchObject({
      title: 'DevOps Engineer',
      company: 'Nordic Cloud',
      location: 'Berlin, DE',
      country: 'de',
      remoteType: 'onsite',
      url: 'https://jobs.example.com/nordic/devops-engineer',
    });
  });

  it('applies keyword and country filters', () => {
    expect(parseJsonLdJobs(html, src, { ...noFilter, keywords: ['kubernetes'] })).toHaveLength(1);
    expect(parseJsonLdJobs(html, src, { ...noFilter, countries: ['de'] })).toHaveLength(1);
    expect(parseJsonLdJobs(html, src, { ...noFilter, countries: ['tn'] })).toHaveLength(0);
  });
});

describe('generic html adapter — explicit selectors', () => {
  const html = fixture('generic-list.html');
  const selectors = {
    item: '.job-card',
    title: '.job-title',
    link: 'a',
    company: '.job-company',
    location: '.job-location',
    description: '.job-summary',
    date: '.job-date',
  };

  it('extracts fields from the configured CSS selectors', () => {
    const jobs = parseSelectorJobs(html, source(), selectors, noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: 'Frontend Engineer',
      company: 'Bright Labs',
      location: 'Paris, France',
      country: 'fr',
      url: 'https://jobs.example.com/jobs/frontend-engineer',
    });
    expect(jobs[0].postedAt.toISOString()).toContain('2026-09-15');
    expect(jobs[1]).toMatchObject({
      title: 'Data Engineer',
      company: 'Metrica',
      country: 'fr',
      remoteType: 'remote',
    });
  });

  it('honours the remoteOnly flag through the pipeline', () => {
    const jobs = parseSelectorJobs(html, source(), selectors, { ...noFilter, remoteOnly: true });
    expect(jobs.map(job => job.title)).toEqual(['Data Engineer']);
  });

  it('routes config.selectors first in parseGenericHtml', () => {
    const jobs = parseGenericHtml(html, source(), { selectors }, noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].company).toBe('Bright Labs');
  });
});

describe('generic html adapter — heuristics', () => {
  const html = fixture('generic-heuristic.html');

  it('finds job links, skips noise and deduplicates by URL', () => {
    const jobs = parseHeuristicJobs(html, source(), noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: 'Backend Engineer (m/f/d)',
      company: 'Flow GmbH',
      location: 'Berlin',
      country: 'de',
      url: 'https://jobs.example.com/job/backend-engineer-berlin',
    });
    expect(jobs[1]).toMatchObject({ title: 'Data Analyst', company: 'Numbers Inc' });
    expect(jobs[1].description).toContain('SQL');
  });

  it('ignores pages with no job-shaped content', () => {
    const html = '<div class="jobs-section"><a href="/page">Company page link</a></div>';
    expect(parseHeuristicJobs(html, source(), noFilter)).toHaveLength(0);
  });

  it('falls back to heuristics when nothing else matches', () => {
    const jobs = parseGenericHtml(fixture('generic-heuristic.html'), source(), {}, noFilter);
    expect(jobs).toHaveLength(2);
  });
});

describe('generic rss adapter', () => {
  const xml = fixture('generic.rss');
  const src = source({ type: 'rss', baseUrl: 'https://feed.example.com' });

  it('splits "Company: Title" and "Title | Company" headings', () => {
    const jobs = parseGenericFeed(xml, src, noFilter);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      company: 'Acme Corp',
      title: 'Senior Backend Engineer',
      url: 'https://feed.example.com/jobs/senior-backend-engineer',
      jobType: 'all',
    });
    expect(jobs[0].description).toContain('Node.js');
    expect(jobs[0].description).not.toContain('<p>');
    expect(jobs[1]).toMatchObject({ title: 'Data Analyst', company: 'Numbers Inc' });
    expect(jobs[2].company).toBe('Unknown');
    expect(jobs[0].postedAt.toISOString()).toContain('2026-09-14');
  });

  it('treats a remote-friendly source as remote and filters keywords', () => {
    const remoteSource = source({ ...src, remoteFriendly: true });
    const remote = parseGenericFeed(xml, remoteSource, { ...noFilter, remoteOnly: true });
    expect(remote).toHaveLength(3);

    const filtered = parseGenericFeed(xml, src, { ...noFilter, keywords: ['postgresql'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Senior Backend Engineer');
  });

  it('prefers configured feedUrls and guesses common paths otherwise', () => {
    const configured = feedCandidates(
      source({ ...src, config: { feedUrls: ['https://x.example/rss'] } })
    );
    expect(configured).toEqual({ urls: ['https://x.example/rss'], guessing: false });

    const guessed = feedCandidates(src);
    expect(guessed.guessing).toBe(true);
    expect(guessed.urls[0]).toBe('https://feed.example.com/feed');
  });
});

describe('generic api adapter', () => {
  const src = source({ type: 'api', config: { endpoint: 'https://api.example.com/search' } });

  it('maps entries with default field guesses', () => {
    const jobs = parseApiPayload(JSON.parse(fixture('generic-api.json')), src, noFilter);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      title: 'Platform Engineer',
      company: 'Orbit Systems',
      country: 'ca',
      remoteType: 'remote',
      url: 'https://jobs.example.com/jobs/platform-engineer',
    });
    expect(jobs[1]).toMatchObject({ company: 'Softworks', country: 'tn' });
    expect(jobs[2].url).toBe('https://jobs.example.com');
  });

  it('applies country filters', () => {
    const payload = JSON.parse(fixture('generic-api.json'));
    const jobs = parseApiPayload(payload, src, { ...noFilter, countries: ['fr'] });
    expect(jobs.map(job => job.title)).toEqual(['Growth Lead']);
  });

  it('supports a fieldMap with nested paths', () => {
    const payload = {
      data: {
        rows: [
          {
            position: { label: 'Site Reliability Engineer' },
            firm: 'Helio',
            href: '/jobs/sre',
          },
        ],
      },
    };
    const mapped = source({
      config: {
        fieldMap: { title: 'position.label', company: 'firm', url: 'href' },
      },
    });
    const jobs = parseApiPayload(payload, mapped, noFilter);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: 'Site Reliability Engineer',
      company: 'Helio',
      url: 'https://jobs.example.com/jobs/sre',
    });
  });

  it('drops entries without a title or without link/company (HN thread payloads)', () => {
    const payload = JSON.parse(fixture('generic-api-hits.json'));
    expect(parseApiPayload(payload, src, noFilter)).toHaveLength(0);
  });
});

describe('resolveAdapter wiring', () => {
  it('prefers the bespoke adapter over the generic factory', () => {
    const adapter = resolveAdapter(source({ type: 'api', config: { adapterId: 'remotive' } }));
    expect(adapter?.id).toBe('remotive');
  });

  it('returns generic adapters for html, rss and configured api sources', () => {
    expect(resolveAdapter(source({ type: 'html' }))?.id).toBe('test-source');
    expect(resolveAdapter(source({ type: 'rss' }))?.id).toBe('test-source');
    expect(
      resolveAdapter(source({ type: 'api', config: { endpoint: 'https://a.example/j' } }))?.id
    ).toBe('test-source');
  });

  it('rejects api sources without an endpoint', () => {
    const bare = source({ type: 'api' });
    expect(resolveAdapter(bare)).toBeNull();
    expect(unavailableReason(bare)).toContain('endpoint');
  });

  it('keeps ai_extract waiting for its phase', () => {
    expect(resolveAdapter(source({ type: 'ai_extract' }))).toBeNull();
    expect(unavailableReason(source({ type: 'ai_extract' }))).toContain('AI extraction');
  });
});
