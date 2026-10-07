import type { ScrapeParams } from '../scraper.types';
import { parseRemotive } from './remotive.adapter';
import { parseRemoteOk } from './remoteok.adapter';
import { parseArbeitnow } from './arbeitnow.adapter';
import { parseWwrFeed } from './weworkremotely.adapter';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const noFilter: ScrapeParams = { keywords: [], countries: [], remoteOnly: false };

describe('remotive adapter', () => {
  const payload = JSON.parse(fixture('remotive.json'));

  it('parses jobs with normalized fields', () => {
    const jobs = parseRemotive(payload, noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceId: 'remotive',
      title: 'Senior React Developer',
      company: 'Acme Corp',
      country: '',
      remoteType: 'remote',
      jobType: 'full-time',
      applyMethod: 'external',
    });
    expect(jobs[0].description).toContain('React');
    expect(jobs[0].description).not.toContain('<p>');
    expect(jobs[0].salary).toEqual({ min: 80000, max: 110000, currency: 'USD', period: 'year' });
    expect(jobs[0].skills).toEqual(expect.arrayContaining(['react', 'typescript']));
    expect(jobs[1].country).toBe('tn');
    expect(jobs[1].jobType).toBe('contract');
  });

  it('filters by keyword', () => {
    const jobs = parseRemotive(payload, { ...noFilter, keywords: ['python'] });
    expect(jobs).toHaveLength(0);
    const react = parseRemotive(payload, { ...noFilter, keywords: ['react'] });
    expect(react).toHaveLength(1);
  });

  it('filters by country', () => {
    const tunisia = parseRemotive(payload, { ...noFilter, countries: ['tn'] });
    expect(tunisia).toHaveLength(1);
    expect(tunisia[0].country).toBe('tn');
  });
});

describe('remoteok adapter', () => {
  const payload = JSON.parse(fixture('remoteok.json'));

  it('skips the legal notice entry', () => {
    const jobs = parseRemoteOk(payload, noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceId: 'remoteok',
      title: 'Senior React Developer',
      company: 'Acme Corp',
      remoteType: 'remote',
    });
    expect(jobs[0].salary).toEqual({ min: 80000, max: 110000, currency: 'USD', period: 'year' });
    expect(jobs[1].country).toBe('tn');
    expect(jobs[1].salary).toBeNull();
    expect(jobs[0].postedAt.toISOString()).toBe(new Date(1759340400 * 1000).toISOString());
  });

  it('applies remoteOnly and keywords', () => {
    const remote = parseRemoteOk(payload, { ...noFilter, remoteOnly: true });
    expect(remote).toHaveLength(2);
    const py = parseRemoteOk(payload, { ...noFilter, keywords: ['python'] });
    expect(py).toHaveLength(1);
    expect(py[0].company).toBe('DataCo');
  });
});

describe('arbeitnow adapter', () => {
  const payload = JSON.parse(fixture('arbeitnow.json'));

  it('parses remote flag, job types and location', () => {
    const jobs = parseArbeitnow(payload, noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceId: 'arbeitnow',
      title: 'Frontend Developer (m/f/d)',
      country: 'de',
      remoteType: 'onsite',
      jobType: 'full-time',
    });
    expect(jobs[1]).toMatchObject({
      remoteType: 'remote',
      jobType: 'part-time',
      country: '',
      experienceLevel: 'entry',
    });
  });

  it('filters on-site jobs out when remoteOnly', () => {
    const jobs = parseArbeitnow(payload, { ...noFilter, remoteOnly: true });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe('Startup GmbH');
  });
});

describe('weworkremotely adapter', () => {
  const xml = fixture('weworkremotely.rss');

  it('splits "Company: Title" and reads region/category', () => {
    const jobs = parseWwrFeed(xml, noFilter);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceId: 'weworkremotely',
      company: 'Stripe',
      title: 'Senior React Engineer',
      remoteType: 'remote',
    });
    expect(jobs[0].description).toContain('Senior React Engineer');
    expect(jobs[0].description).not.toContain('&lt;');
    expect(jobs[0].skills).toEqual(expect.arrayContaining(['react']));
    expect(jobs[1].location).toBe('North America Only');
    expect(jobs[1].country).toBe('us');
    expect(jobs[0].postedAt.getFullYear()).toBe(2026);
  });

  it('filters by keyword', () => {
    const jobs = parseWwrFeed(xml, { ...noFilter, keywords: ['wordpress'] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe('PHPExpert');
  });
});
