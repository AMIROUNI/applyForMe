import type { ExtensionSearchContext } from './linkedin';
import { searchLocation, searchTerm } from './linkedin';

export const buildIndeedSearchUrl = (ctx: ExtensionSearchContext): string => {
  const url = new URL('https://www.indeed.com/jobs');
  const keywords = searchTerm(ctx.keywords);
  if (keywords) url.searchParams.set('q', keywords);
  const location = searchLocation(ctx.countries);
  if (location) url.searchParams.set('l', location);
  if (ctx.remoteOnly) url.searchParams.set('remote', '1');
  return url.toString();
};
