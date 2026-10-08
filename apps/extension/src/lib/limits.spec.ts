import { DELAY_MAX_MS, DELAY_MIN_MS, PAGE_CAP, randomDelayMs } from '../lib/limits';
import { isKnownSource, isSupportedSearchUrl, hostOf } from '../lib/hosts';

describe('limits', () => {
  it('keeps delays between 2 and 5 seconds', () => {
    expect(DELAY_MIN_MS).toBe(2000);
    expect(DELAY_MAX_MS).toBe(5000);
    expect(randomDelayMs(() => 0)).toBe(2000);
    for (const value of [0, 0.1, 0.33, 0.5, 0.77, 0.999999]) {
      const delay = randomDelayMs(() => value);
      expect(delay).toBeGreaterThanOrEqual(DELAY_MIN_MS);
      expect(delay).toBeLessThan(DELAY_MAX_MS);
    }
  });

  it('captures at most three pages per source', () => {
    expect(PAGE_CAP).toBe(3);
  });
});

describe('hosts allowlist', () => {
  it('accepts the supported job site hosts', () => {
    expect(
      isSupportedSearchUrl('linkedin_jobs', 'https://www.linkedin.com/jobs/search?keywords=x')
    ).toBe(true);
    expect(
      isSupportedSearchUrl('linkedin_posts', 'https://www.linkedin.com/search/results/content/')
    ).toBe(true);
    expect(isSupportedSearchUrl('indeed', 'https://fr.indeed.com/jobs?q=dev')).toBe(true);
    expect(isSupportedSearchUrl('indeed', 'https://www.indeed.com/jobs?remote=1')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isSupportedSearchUrl('linkedin_jobs', 'https://evil.example.com/jobs')).toBe(false);
    expect(
      isSupportedSearchUrl('linkedin_jobs', 'https://www.linkedin.com.evil.example/jobs')
    ).toBe(false);
    expect(isSupportedSearchUrl('indeed', 'https://www.linkedin.com/jobs')).toBe(false);
    expect(isSupportedSearchUrl('indeed', 'not a url')).toBe(false);
    expect(isSupportedSearchUrl('unknown_source', 'https://www.indeed.com/jobs')).toBe(false);
  });

  it('knows the extension sources', () => {
    expect(isKnownSource('linkedin_jobs')).toBe(true);
    expect(isKnownSource('linkedin_posts')).toBe(true);
    expect(isKnownSource('indeed')).toBe(true);
    expect(isKnownSource('current_page')).toBe(false);
  });

  it('parses hosts defensively', () => {
    expect(hostOf('https://www.linkedin.com/jobs')).toBe('www.linkedin.com');
    expect(hostOf('nope')).toBeNull();
  });
});
