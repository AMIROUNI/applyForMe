import { canFetch } from '../robots';
import { fetchText } from '../http';
import {
  extractSkills,
  passesFilters,
  primaryCountry,
  stripHtml,
  toExperienceLevel,
  toJobType,
  toRemoteType,
} from '../normalize';
import { parseRss } from './rss';
import type { NormalizedJob, ScrapeParams, SourceAdapter } from '../scraper.types';

export const WWR_FEEDS = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
];

const splitTitle = (raw: string): { company: string; title: string } => {
  const sep = raw.indexOf(':');
  if (sep > 0 && sep < raw.length - 1) {
    return { company: raw.slice(0, sep).trim(), title: raw.slice(sep + 1).trim() };
  }
  const dash = raw.indexOf(' - ');
  if (dash > 0) {
    return { company: raw.slice(0, dash).trim(), title: raw.slice(dash + 3).trim() };
  }
  return { company: 'Unknown', title: raw.trim() };
};

export function parseWwrFeed(xml: string, params: ScrapeParams): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const item of parseRss(xml)) {
    if (!item.title || !item.link) continue;
    const { company, title } = splitTitle(item.title);
    const description = stripHtml(item.description ?? '', 600);
    const location = item.region || 'Remote';
    const postedAt = item.pubDate ? new Date(item.pubDate) : new Date();

    const normalized: NormalizedJob = {
      sourceId: 'weworkremotely',
      sourceName: 'We Work Remotely',
      title,
      company,
      location,
      country: primaryCountry(location, params.countries),
      description,
      url: item.link,
      postedAt: Number.isNaN(postedAt.getTime()) ? new Date() : postedAt,
      remoteType: toRemoteType(location, true),
      jobType: toJobType('full-time'),
      experienceLevel: toExperienceLevel(title),
      skills: extractSkills(`${title} ${description}`, [item.category].filter(Boolean)),
      salary: null,
      applyMethod: 'external',
    };
    if (!passesFilters(normalized, params)) continue;
    jobs.push(normalized);
  }
  return jobs;
}

export const wwrScraper: SourceAdapter = {
  id: 'weworkremotely',
  name: 'We Work Remotely',
  async scrape(params) {
    const jobs: NormalizedJob[] = [];
    const seen = new Set<string>();
    for (const feed of WWR_FEEDS) {
      await canFetch(feed);
      const xml = await fetchText(feed);
      for (const job of parseWwrFeed(xml, params)) {
        if (seen.has(job.url)) continue;
        seen.add(job.url);
        jobs.push(job);
      }
    }
    return jobs.slice(0, 40);
  },
};
