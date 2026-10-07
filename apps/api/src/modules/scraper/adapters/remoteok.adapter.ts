import { canFetch } from '../robots';
import { fetchJson } from '../http';
import {
  extractSkills,
  parseSalary,
  passesFilters,
  primaryCountry,
  stripHtml,
  toEpochDate,
  toExperienceLevel,
  toJobType,
  toRemoteType,
} from '../normalize';
import type { NormalizedJob, ScrapeParams, SourceAdapter } from '../scraper.types';

export const REMOTEOK_API = 'https://remoteok.com/api';

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
  legal?: string;
}

export type RemoteOkPayload = Array<RemoteOkJob | { legal: string }>;

export function parseRemoteOk(payload: RemoteOkPayload, params: ScrapeParams): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object' || 'legal' in entry) continue;
    const job = entry;
    const title = (job.position ?? '').trim();
    const url = job.url || job.apply_url || '';
    if (!title || !url) continue;

    const location = (job.location ?? '').trim();
    const description = stripHtml(job.description ?? '', 600);
    const skills = extractSkills(`${title} ${description}`, job.tags ?? []);
    const salary =
      job.salary_min && job.salary_max
        ? parseSalary(`${job.salary_min} - ${job.salary_max}`)
        : null;

    const normalized: NormalizedJob = {
      sourceId: 'remoteok',
      sourceName: 'RemoteOK',
      title,
      company: (job.company ?? 'Unknown').trim(),
      location: location || 'Remote',
      country: primaryCountry(location, params.countries),
      description,
      url,
      postedAt: toEpochDate(job.epoch ?? job.date),
      remoteType: toRemoteType(location, true),
      jobType: toJobType(job.slug),
      experienceLevel: toExperienceLevel(title),
      skills,
      salary,
      applyMethod: 'external',
    };
    if (!passesFilters(normalized, params)) continue;
    jobs.push(normalized);
  }
  return jobs;
}

export const remoteOkScraper: SourceAdapter = {
  id: 'remoteok',
  name: 'RemoteOK',
  async scrape(params) {
    const url = REMOTEOK_API;
    await canFetch(url);
    const payload = await fetchJson<RemoteOkPayload>(url, {
      headers: { Accept: 'application/json' },
    });
    return parseRemoteOk(payload, params).slice(0, 40);
  },
};
