import type { PageDoc, ParsedPage } from './page';
import { parseLinkedinJobs } from './linkedin-jobs';
import { parseLinkedinPosts } from './linkedin-posts';
import { parseIndeed } from './indeed';

export type { PageDoc, PageEl, ParsedPage } from './page';
export { createDomPage } from './page';

export type PageParser = (page: PageDoc) => ParsedPage;

const PARSERS: Record<string, PageParser> = {
  linkedin_jobs: parseLinkedinJobs,
  linkedin_posts: parseLinkedinPosts,
  indeed: parseIndeed,
};

export const hasParser = (source: string): boolean => source in PARSERS;

export const parsePage = (source: string, page: PageDoc): ParsedPage => {
  const parser = PARSERS[source];
  if (!parser) throw new Error(`No page parser for source "${source}"`);
  return parser(page);
};
