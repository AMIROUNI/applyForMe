import {
  buildExtensionSearchUrl,
  buildIndeedSearchUrl,
  buildLinkedinJobsSearchUrl,
  buildLinkedinPostsSearchUrl,
  extensionHostAllowlist,
  isAllowedExtensionSearchUrl,
  type ExtensionSearchContext,
} from './index';

const ctx = (overrides: Partial<ExtensionSearchContext> = {}): ExtensionSearchContext => ({
  keywords: [],
  countries: [],
  remoteOnly: false,
  baseUrl: 'https://www.linkedin.com/jobs',
  ...overrides,
});

describe('extension search URLs', () => {
  it('builds a LinkedIn jobs search from keywords, country and the remote flag', () => {
    const url = new URL(
      buildLinkedinJobsSearchUrl(
        ctx({ keywords: ['react', 'node'], countries: ['fr'], remoteOnly: true })
      )
    );
    expect(`${url.origin}${url.pathname}`).toBe('https://www.linkedin.com/jobs/search');
    expect(url.searchParams.get('keywords')).toBe('react node');
    expect(url.searchParams.get('location')).toBe('France');
    expect(url.searchParams.get('f_WT')).toBe('2');
  });

  it('leaves out parts the user did not choose', () => {
    const url = new URL(buildLinkedinJobsSearchUrl(ctx()));
    expect(url.searchParams.get('keywords')).toBeNull();
    expect(url.searchParams.get('location')).toBeNull();
    expect(url.searchParams.get('f_WT')).toBeNull();
  });

  it('falls back to the country code when the name is unknown', () => {
    const url = new URL(buildLinkedinJobsSearchUrl(ctx({ countries: ['zz'] })));
    expect(url.searchParams.get('location')).toBe('ZZ');
  });

  it('always searches hiring posts on LinkedIn', () => {
    const url = new URL(buildLinkedinPostsSearchUrl(ctx({ keywords: ['designer'] })));
    expect(`${url.origin}${url.pathname}`).toBe('https://www.linkedin.com/search/results/content/');
    expect(url.searchParams.get('keywords')).toBe('hiring designer');
    expect(new URL(buildLinkedinPostsSearchUrl(ctx())).searchParams.get('keywords')).toBe('hiring');
  });

  it('builds an Indeed search with query, location and remote flag', () => {
    const url = new URL(
      buildIndeedSearchUrl(ctx({ keywords: ['nurse'], countries: ['us'], remoteOnly: true }))
    );
    expect(`${url.origin}${url.pathname}`).toBe('https://www.indeed.com/jobs');
    expect(url.searchParams.get('q')).toBe('nurse');
    expect(url.searchParams.get('l')).toBe('United States');
    expect(url.searchParams.get('remote')).toBe('1');
  });

  it('resolves builders per source id and falls back to the base url', () => {
    expect(buildExtensionSearchUrl('indeed', ctx({ keywords: ['qa'] }))).toContain('q=qa');
    expect(
      buildExtensionSearchUrl('current_page', ctx({ baseUrl: 'https://boards.example.com/jobs' }))
    ).toBe('https://boards.example.com/jobs');
    expect(
      buildExtensionSearchUrl('unknown-source', ctx({ baseUrl: 'https://boards.example.com/jobs' }))
    ).toBe('https://boards.example.com/jobs');
    expect(() => buildExtensionSearchUrl('unknown-source', ctx({ baseUrl: '' }))).toThrow(
      'No extension search URL'
    );
  });

  it('restricts a task to the hosts of its source', () => {
    expect(extensionHostAllowlist('linkedin_jobs', 'https://www.linkedin.com/jobs')).toEqual([
      'www.linkedin.com',
      'linkedin.com',
    ]);
    expect(extensionHostAllowlist('current_page', 'https://boards.example.com/jobs')).toEqual([
      'boards.example.com',
    ]);

    expect(
      isAllowedExtensionSearchUrl(
        'linkedin_jobs',
        'https://www.linkedin.com/jobs',
        'https://www.linkedin.com/jobs/search?keywords=react'
      )
    ).toBe(true);
    expect(
      isAllowedExtensionSearchUrl(
        'linkedin_jobs',
        'https://www.linkedin.com/jobs',
        'https://evil.example.com/jobs'
      )
    ).toBe(false);
    expect(
      isAllowedExtensionSearchUrl(
        'current_page',
        'https://boards.example.com/jobs',
        'https://boards.example.com/listing/1'
      )
    ).toBe(true);
    expect(
      isAllowedExtensionSearchUrl(
        'current_page',
        'https://boards.example.com/jobs',
        'https://other.example.org/'
      )
    ).toBe(false);
    expect(isAllowedExtensionSearchUrl('indeed', 'https://www.indeed.com', 'not-a-url')).toBe(
      false
    );
  });
});
