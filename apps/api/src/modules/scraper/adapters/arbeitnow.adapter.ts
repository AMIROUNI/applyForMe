import { canFetch } from '../robots';
import { fetchJson } from '../http';
import {
  extractSkills,
  passesFilters,
  primaryCountry,
  stripHtml,
  toEpochDate,
  toExperienceLevel,
  toJobType,
  toRemoteType,
} from '../normalize';
import type { NormalizedJob, ScrapeParams, SourceAdapter } from '../scraper.types';

export const ARBEITNOW_API = 'https://www.arbeitnow.com/api/job-board-api';

export interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

export interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links?: Record<string, string>;
}

export function parseArbeitnow(payload: ArbeitnowResponse, params: ScrapeParams): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const job of payload.data ?? []) {
    if (!job.url || !job.title) continue;
    const location = job.remote ? job.location || 'Remote' : job.location || '';
    const description = stripHtml(job.description ?? '', 600);
    const jobType = toJobType((job.job_types ?? []).join(' '));

    const normalized: NormalizedJob = {
      sourceId: 'arbeitnow',
      sourceName: 'Arbeitnow',
      title: job.title.trim(),
      company: (job.company_name ?? 'Unknown').trim(),
      location,
      country: primaryCountry(location, params.countries),
      description,
      url: job.url,
      postedAt: toEpochDate(job.created_at),
      remoteType: toRemoteType(location, job.remote),
      jobType,
      experienceLevel: toExperienceLevel(job.title),
      skills: extractSkills(`${job.title} ${description}`, job.tags ?? []),
      salary: null,
      applyMethod: 'external',
    };
    if (!passesFilters(normalized, params)) continue;
    jobs.push(normalized);
  }
  return jobs;
}

export const arbeitnowScraper: SourceAdapter = {
  id: 'arbeitnow',
  name: 'Arbeitnow',
  async scrape(params) {
    const url = ARBEITNOW_API;
    await canFetch(url);
    const payload = await fetchJson<ArbeitnowResponse>(url);
    return parseArbeitnow(payload, params).slice(0, 40);
  },
};
