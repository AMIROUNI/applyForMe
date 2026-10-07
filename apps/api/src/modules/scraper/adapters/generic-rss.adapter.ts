import { canFetch } from '../robots';
import { fetchText } from '../http';
import {
  extractSkills,
  passesFilters,
  primaryCountry,
  stripHtml,
  toExperienceLevel,
  toRemoteType,
} from '../normalize';
import { parseRss } from './rss';
import { absoluteUrl, parsePostDate, splitHeading } from './generic-common';
import type { NormalizedJob, RegistrySource, ScrapeParams, SourceAdapter } from '../scraper.types';

const MAX_JOBS = 40;

/** Common feed locations tried when the registry does not list `feedUrls`. */
const FEED_GUESSES = ['/feed', '/rss', '/jobs/rss', '/jobs/feed', '/careers/feed'];

export function parseGenericFeed(
  xml: string,
  source: RegistrySource,
  params: ScrapeParams
): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const item of parseRss(xml)) {
    if (!item.title || !item.link) continue;
    const { company, title } = splitHeading(item.title);
    const description = stripHtml(item.description, 600);
    const location = item.region || (source.remoteFriendly ? 'Remote' : '');
    const url = absoluteUrl(item.link, source.baseUrl);
    if (!url) continue;

    const job: NormalizedJob = {
      sourceId: source.id,
      sourceName: source.name,
      title,
      company,
      location,
      country: primaryCountry(location, params.countries),
      description,
      url,
      postedAt: parsePostDate(item.pubDate),
      remoteType: toRemoteType(location, source.remoteFriendly),
      jobType: 'all',
      experienceLevel: toExperienceLevel(title),
      skills: extractSkills(`${title} ${description}`, [item.category].filter(Boolean)),
      salary: null,
      applyMethod: 'external',
    };
    if (!passesFilters(job, params)) continue;
    jobs.push(job);
  }
  return jobs;
}

/** Configured feeds are authoritative; otherwise guess well-known feed paths. */
export function feedCandidates(source: RegistrySource): { urls: string[]; guessing: boolean } {
  const configured = source.config.feedUrls ?? [];
  if (configured.length) return { urls: configured, guessing: false };

  let origin = '';
  try {
    origin = new URL(source.baseUrl).origin;
  } catch {
    return { urls: [], guessing: true };
  }
  return { urls: FEED_GUESSES.map(path => `${origin}${path}`), guessing: true };
}

export function createRssAdapter(source: RegistrySource): SourceAdapter {
  return {
    id: source.id,
    name: source.name,
    async scrape(params) {
      const { urls, guessing } = feedCandidates(source);
      const jobs: NormalizedJob[] = [];
      const seen = new Set<string>();

      for (const url of urls) {
        let xml = '';
        try {
          await canFetch(url);
          xml = await fetchText(url);
        } catch {
          // robots block, missing feed or upstream error -> try the next candidate
          continue;
        }
        for (const job of parseGenericFeed(xml, source, params)) {
          if (seen.has(job.url)) continue;
          seen.add(job.url);
          jobs.push(job);
        }
        // First guessed feed that yields jobs wins; configured feeds all run.
        if ((guessing && jobs.length) || jobs.length >= MAX_JOBS) break;
      }

      return jobs.slice(0, MAX_JOBS);
    },
  };
}
