import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseLinkedinPosts } from '../../lib/parse/linkedin-posts';
import { fromHtml } from '../cheerio-page';

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

describe('parseLinkedinPosts', () => {
  it('extracts posts with a permalink and skips the rest', () => {
    const { items, nextUrl } = parseLinkedinPosts(fromHtml(fixture('linkedin-posts.html')));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      company: 'Jane Doe · Hiring Manager',
      location: '',
      url: 'https://www.linkedin.com/posts/jane-doe_activity-7001001-abc',
    });
    expect(items[0].title).toContain('We are hiring a Node.js developer in Tunis');
    expect(items[0].description).toContain('DM me for details!');
    expect(nextUrl).toBeNull();
  });

  it('never produces a title longer than 300 characters', () => {
    const longText = 'hiring '.repeat(80);
    const html = `
      <div class="feed-shared-update-v2" data-urn="urn:li:activity:1">
        <div class="feed-shared-text"><span dir="ltr">${longText}</span></div>
        <a href="/posts/x_activity-1">post</a>
      </div>`;
    const { items } = parseLinkedinPosts(fromHtml(html));
    expect(items).toHaveLength(1);
    expect(items[0].title.length).toBeLessThanOrEqual(300);
  });

  it('follows an anchored next page when the markup provides one', () => {
    const html = `
      <div class="feed-shared-update-v2" data-urn="urn:li:activity:2">
        <div class="feed-shared-text"><span dir="ltr">Open role</span></div>
        <a href="/posts/y_activity-2">post</a>
      </div>
      <a aria-label="Next" href="/search/results/content/?page=2">Next</a>`;
    const { nextUrl } = parseLinkedinPosts(fromHtml(html));
    expect(nextUrl).toBe('https://www.linkedin.com/search/results/content/?page=2');
  });
});
