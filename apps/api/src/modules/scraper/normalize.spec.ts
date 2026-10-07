import {
  extractSkills,
  foldAccents,
  parseSalary,
  passesFilters,
  primaryCountry,
  scoreJob,
  stripHtml,
  toCountries,
  toExperienceLevel,
  toJobType,
  toRemoteType,
} from './normalize';
import type { NormalizedJob, ScrapeParams } from './scraper.types';

describe('normalize helpers', () => {
  it('folds accents', () => {
    expect(foldAccents('Développeur PHP')).toBe('developpeur php');
  });

  it('maps countries from free text', () => {
    expect(toCountries('Tunis, Tunisia')).toEqual(['tn']);
    expect(toCountries('Paris, France')).toEqual(['fr']);
    expect(toCountries('Berlin, Germany')).toEqual(['de']);
    expect(toCountries('Worldwide')).toEqual([]);
    expect(toCountries('United States')).toEqual(['us']);
  });

  it('prefers the requested country as primary', () => {
    expect(primaryCountry('USA, UK', ['gb'])).toBe('gb');
    expect(primaryCountry('USA, UK', ['tn'])).toBe('us');
    expect(primaryCountry('', ['tn'])).toBe('');
  });

  it('infers remote type, job type and experience', () => {
    expect(toRemoteType('Worldwide', false)).toBe('remote');
    expect(toRemoteType('', false)).toBe('onsite');
    expect(toRemoteType('Paris / Remote', false)).toBe('remote');
    expect(toRemoteType('Berlin', false)).toBe('onsite');

    expect(toJobType('full_time')).toBe('full-time');
    expect(toJobType('Part-time')).toBe('part-time');
    expect(toJobType('Freelance')).toBe('contract');
    expect(toJobType('internship')).toBe('internship');
    expect(toJobType('')).toBe('all');

    expect(toExperienceLevel('Senior React Developer')).toBe('senior');
    expect(toExperienceLevel('Junior Backend Engineer')).toBe('entry');
    expect(toExperienceLevel('Engineering Manager')).toBe('lead');
    expect(toExperienceLevel('CTO')).toBe('executive');
    expect(toExperienceLevel('React Developer')).toBe('all');
  });

  it('strips html down to text', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>', 100)).toBe('Hello world');
    expect(stripHtml('<script>x()</script>ok', 100)).toBe('ok');
    expect(stripHtml('a'.repeat(50), 10).length).toBeLessThanOrEqual(10);
  });

  it('extracts skills from text and tags', () => {
    const skills = extractSkills('We use React and PostgreSQL daily', ['Docker']);
    expect(skills).toEqual(expect.arrayContaining(['docker', 'react', 'postgresql']));
    expect(skills.length).toBeLessThanOrEqual(8);
  });

  it('parses salary ranges', () => {
    expect(parseSalary('$80k - $110k')).toEqual({
      min: 80000,
      max: 110000,
      currency: 'USD',
      period: 'year',
    });
    expect(parseSalary('40€-50€ per hour')).toEqual({
      min: 40,
      max: 50,
      currency: 'EUR',
      period: 'hour',
    });
    expect(parseSalary('Competitive')).toBeNull();
    expect(parseSalary('')).toBeNull();
  });

  it('scores keyword matches', () => {
    const noKeywords = scoreJob('React Dev', 'anything', []);
    expect(noKeywords.matchScore).toBe(70);

    const titleHit = scoreJob('React Developer', 'we build apps', ['react', 'go']);
    expect(titleHit.matchScore).toBe(75);
    expect(titleHit.matchReason).toBe('Matches keyword: react');

    const none = scoreJob('Designer', 'pixels', ['react']);
    expect(none.matchScore).toBe(40);
    expect(none.matchReason).toBe('No keyword match');
  });

  it('passesFilters enforces remote, country and keywords', () => {
    const job: NormalizedJob = {
      sourceId: 'x',
      sourceName: 'X',
      title: 'React Developer',
      company: 'Acme',
      location: 'Tunisia',
      country: 'tn',
      description: 'Build apps',
      url: 'https://example.com/1',
      postedAt: new Date(),
      remoteType: 'onsite',
      jobType: 'all',
      experienceLevel: 'all',
      skills: [],
      salary: null,
      applyMethod: 'external',
    };
    const base: ScrapeParams = { keywords: [], countries: [], remoteOnly: false };

    expect(passesFilters(job, base)).toBe(true);
    expect(passesFilters(job, { ...base, remoteOnly: true })).toBe(false);
    expect(passesFilters(job, { ...base, countries: ['tn'] })).toBe(true);
    expect(passesFilters(job, { ...base, countries: ['fr'] })).toBe(false);
    expect(passesFilters(job, { ...base, keywords: ['react'] })).toBe(true);
    expect(passesFilters(job, { ...base, keywords: ['kotlin'] })).toBe(false);
  });
});
