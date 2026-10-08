import type { ParsedPage, PageDoc, PageEl } from './page';

const BASE = 'https://www.indeed.com';

const absoluteUrl = (href: string | null): string | null => {
  if (!href) return null;
  try {
    return new URL(href, BASE).toString();
  } catch {
    return null;
  }
};

const jobLink = (card: PageEl): PageEl | null =>
  card.select('a[href*="jk="][href]')[0] ?? card.select('a[href*="/viewjob"]')[0] ?? null;

const nextHref = (page: PageDoc): string | null => {
  for (const candidate of page.select('a[data-testid="pagination-page-next"], a.next')) {
    const href = absoluteUrl(candidate.attr('href'));
    if (href) return href;
  }
  return null;
};

export const parseIndeed = (page: PageDoc): ParsedPage => {
  const items: ParsedPage['items'] = [];
  for (const card of page.select('li.job_seen_beacon, li.result, div.cardOutline')) {
    const link = jobLink(card);
    const url = absoluteUrl(link?.attr('href') ?? null);
    const title = card.text('h2.jobTitle span[title]') || card.text('h2.jobTitle');
    if (!title || !url) continue;
    items.push({
      title,
      company: card.text('[data-testid="company-name"], .companyName'),
      location: card.text('[data-testid="text-location"], .companyLocation'),
      url,
      description: card.text('.job-snippet'),
      skills: [],
    });
  }
  return { items, nextUrl: nextHref(page) };
};
