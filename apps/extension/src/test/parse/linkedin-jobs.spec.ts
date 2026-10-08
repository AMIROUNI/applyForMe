import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseLinkedinJobs } from '../../lib/parse/linkedin-jobs';
import { fromHtml } from '../cheerio-page';

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

describe('parseLinkedinJobs', () => {
  it('extracts job cards and drops the ones without a link', () => {
    const { items, nextUrl } = parseLinkedinJobs(fromHtml(fixture('linkedin-jobs.html')));

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Senior React Engineer',
      company: 'Acme Corp',
      location: 'Paris, France',
      url: 'https://www.linkedin.com/jobs/view/4001-senior-react-engineer-at-acme?refId=abc&trackingId=xyz',
      postedAt: '2026-09-28',
      description: '',
      skills: [],
    });
    expect(items[1]).toMatchObject({
      title: 'DevOps Engineer',
      company: 'Nimbus',
      location: 'Remote - Europe',
      url: 'https://www.linkedin.com/jobs/view/4003-devops-engineer-at-nimbus-777',
      postedAt: '2026-10-01',
    });
    expect(nextUrl).toBe('https://www.linkedin.com/jobs/search?keywords=developer&start=25');
  });

  it('returns no next link when pagination is disabled', () => {
    const html = `
      <ul>
        <li class="job-card-container">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/1">Role</a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Role</h3>
            <h4 class="base-search-card__subtitle">Co</h4>
          </div>
        </li>
      </ul>
      <nav><a aria-label="Next" aria-disabled="true">Next</a></nav>`;
    const { items, nextUrl } = parseLinkedinJobs(fromHtml(html));
    expect(items).toHaveLength(1);
    expect(nextUrl).toBeNull();
  });
});
