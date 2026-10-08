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

const permalink = (card: PageEl): string | null => {
  const anchors = [...card.select('a[href*="/posts/"]'), ...card.select('a[href*="/pulse/"]')];
  for (const anchor of anchors) {
    const href = absoluteUrl(anchor.attr('href'));
    if (href) return href;
  }
  return null;
};

const nextHref = (page: PageDoc): string | null => {
  for (const candidate of page.select('button[aria-label="Next"], a[aria-label="Next"]')) {
    const href = absoluteUrl(candidate.attr('href'));
    if (href) return href;
  }
  return null;
};

export const parseLinkedinPosts = (page: PageDoc): ParsedPage => {
  const items: ParsedPage['items'] = [];
  for (const card of page.select('div.feed-shared-update-v2, div[data-urn^="urn:li:activity"]')) {
    const text = card.text(
      '.feed-shared-text span[dir="ltr"], .update-components-text, .feed-shared-text'
    );
    const url = permalink(card);
    if (!text || !url) continue;
    items.push({
      title: text.slice(0, 300),
      company: card.text('.feed-shared-actor__name, .update-components-actor__name').slice(0, 200),
      location: '',
      url,
      description: text.slice(0, 20_000),
      skills: [],
    });
  }
  return { items, nextUrl: nextHref(page) };
};
