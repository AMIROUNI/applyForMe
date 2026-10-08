import type { ParsedPage, PageDoc, PageEl } from './page';

const BASE = 'https://www.linkedin.com';

const absoluteUrl = (href: string | null): string | null => {
  if (!href) return null;
  try {
    return new URL(href, BASE).toString();
  } catch {
    return null;
  }
};

const linkEl = (card: PageEl): PageEl | null =>
  card.select('a.base-card__full-link')[0] ?? card.select('a[href*="/jobs/view/"]')[0] ?? null;

const nextHref = (page: PageDoc): string | null => {
  const candidates = page.select(
    'a[aria-label="Next"], a.artdeco-pagination__button--next, .artdeco-pagination a.next'
  );
  for (const candidate of candidates) {
    if (candidate.attr('aria-disabled') === 'true') continue;
    const href = absoluteUrl(candidate.attr('href'));
    if (href) return href;
  }
  return null;
};

export const parseLinkedinJobs = (page: PageDoc): ParsedPage => {
  const items: ParsedPage['items'] = [];
  for (const card of page.select('li.job-card-container, .jobs-search-results-list > li')) {
    const title = card.text('.base-search-card__title');
    const url = absoluteUrl(linkEl(card)?.attr('href') ?? null);
    if (!title || !url) continue;
    const postedAt = card.select('time[datetime]')[0]?.attr('datetime');
    items.push({
      title,
      company: card.text('.base-search-card__subtitle'),
      location: card.text('.job-search-card__location'),
      url,
      description: '',
      skills: [],
      ...(postedAt ? { postedAt } : {}),
    });
  }
  return { items, nextUrl: nextHref(page) };
};
