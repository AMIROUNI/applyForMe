import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseIndeed } from '../../lib/parse/indeed';
import { fromHtml } from '../cheerio-page';

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

describe('parseIndeed', () => {
  it('extracts results and skips cards without a link', () => {
    const { items, nextUrl } = parseIndeed(fromHtml(fixture('indeed.html')));

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Backend Developer Python',
      company: 'DataWorks',
      location: 'Tunis, Tunisia',
      url: 'https://www.indeed.com/viewjob?jk=1a2b3c&from=serp&vjs=3',
      description: 'Build REST APIs Postgres and Redis',
      skills: [],
    });
    expect(items[1]).toMatchObject({
      title: 'Platform Engineer',
      company: 'CloudNine',
      location: 'Remote',
      url: 'https://www.indeed.com/viewjob?jk=4d5e6f&from=serp',
      description: 'Kubernetes, CI/CD, on-call rotation.',
    });
    expect(nextUrl).toBe('https://www.indeed.com/jobs?q=developer&start=10');
  });

  it('returns no next link on the last page', () => {
    const html = `
      <li class="job_seen_beacon">
        <a href="https://www.indeed.com/viewjob?jk=zz">
          <h2 class="jobTitle"><span title="Solo">Solo</span></h2>
        </a>
        <span data-testid="company-name">Only Co</span>
      </li>`;
    const { items, nextUrl } = parseIndeed(fromHtml(html));
    expect(items).toHaveLength(1);
    expect(nextUrl).toBeNull();
  });
});
