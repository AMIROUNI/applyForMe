import type { ExtensionSearchContext, ExtensionUrlBuilder } from './linkedin';
import { buildLinkedinJobsSearchUrl, buildLinkedinPostsSearchUrl } from './linkedin';
import { buildIndeedSearchUrl } from './indeed';
import { buildCurrentPageSearchUrl } from './generic';

export type { ExtensionSearchContext, ExtensionUrlBuilder } from './linkedin';
export { buildLinkedinJobsSearchUrl, buildLinkedinPostsSearchUrl } from './linkedin';
export { buildIndeedSearchUrl } from './indeed';
export { buildCurrentPageSearchUrl } from './generic';

export const EXTENSION_URL_BUILDERS: Record<string, ExtensionUrlBuilder> = {
  linkedin_jobs: buildLinkedinJobsSearchUrl,
  linkedin_posts: buildLinkedinPostsSearchUrl,
  indeed: buildIndeedSearchUrl,
  current_page: buildCurrentPageSearchUrl,
};

export const EXTENSION_SOURCE_HOSTS: Record<string, string[]> = {
  linkedin_jobs: ['www.linkedin.com', 'linkedin.com'],
  linkedin_posts: ['www.linkedin.com', 'linkedin.com'],
  indeed: [
    'www.indeed.com',
    'indeed.com',
    'ca.indeed.com',
    'uk.indeed.com',
    'fr.indeed.com',
    'de.indeed.com',
  ],
  current_page: [],
};

const hostOf = (value: string): string | null => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const buildExtensionSearchUrl = (sourceId: string, ctx: ExtensionSearchContext): string => {
  const builder = EXTENSION_URL_BUILDERS[sourceId];
  if (builder) return builder(ctx);
  if (ctx.baseUrl) return ctx.baseUrl;
  throw new Error(`No extension search URL for source "${sourceId}"`);
};

export const extensionHostAllowlist = (sourceId: string, baseUrl: string): string[] => {
  const hosts = new Set(EXTENSION_SOURCE_HOSTS[sourceId] ?? []);
  const baseHost = hostOf(baseUrl);
  if (baseHost) hosts.add(baseHost);
  return [...hosts];
};

export const isAllowedExtensionSearchUrl = (
  sourceId: string,
  baseUrl: string,
  searchUrl: string
): boolean => {
  const host = hostOf(searchUrl);
  if (!host) return false;
  return extensionHostAllowlist(sourceId, baseUrl).includes(host);
};
