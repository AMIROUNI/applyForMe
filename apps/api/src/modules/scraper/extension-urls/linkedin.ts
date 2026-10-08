export interface ExtensionSearchContext {
  keywords: string[];
  countries: string[];
  remoteOnly: boolean;
  baseUrl: string;
}

export type ExtensionUrlBuilder = (ctx: ExtensionSearchContext) => string;

const COUNTRY_NAMES: Record<string, string> = {
  ae: 'United Arab Emirates',
  be: 'Belgium',
  bh: 'Bahrain',
  ca: 'Canada',
  de: 'Germany',
  dz: 'Algeria',
  eg: 'Egypt',
  es: 'Spain',
  fr: 'France',
  gb: 'United Kingdom',
  jo: 'Jordan',
  kw: 'Kuwait',
  lb: 'Lebanon',
  ma: 'Morocco',
  om: 'Oman',
  qa: 'Qatar',
  sa: 'Saudi Arabia',
  tn: 'Tunisia',
  us: 'United States',
};

export const searchLocation = (countries: string[]): string | null => {
  for (const code of countries) {
    const key = code.trim().toLowerCase();
    if (!key) continue;
    return COUNTRY_NAMES[key] ?? key.toUpperCase();
  }
  return null;
};

export const searchTerm = (keywords: string[]): string =>
  keywords
    .map(keyword => keyword.trim())
    .filter(Boolean)
    .join(' ');

export const buildLinkedinJobsSearchUrl = (ctx: ExtensionSearchContext): string => {
  const url = new URL('https://www.linkedin.com/jobs/search');
  const keywords = searchTerm(ctx.keywords);
  if (keywords) url.searchParams.set('keywords', keywords);
  const location = searchLocation(ctx.countries);
  if (location) url.searchParams.set('location', location);
  if (ctx.remoteOnly) url.searchParams.set('f_WT', '2');
  return url.toString();
};

export const buildLinkedinPostsSearchUrl = (ctx: ExtensionSearchContext): string => {
  const url = new URL('https://www.linkedin.com/search/results/content/');
  url.searchParams.set('keywords', ['hiring', searchTerm(ctx.keywords)].filter(Boolean).join(' '));
  url.searchParams.set('origin', 'GLOBAL_SEARCH_HEADER');
  return url.toString();
};
