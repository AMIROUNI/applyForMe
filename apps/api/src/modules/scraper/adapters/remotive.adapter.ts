import { canFetch } from '../robots';
import { fetchJson } from '../http';
import {
  extractSkills,
  parseSalary,
  passesFilters,
  primaryCountry,
  stripHtml,
  toExperienceLevel,
  toJobType,
  toRemoteType,
} from '../normalize';
import type { NormalizedJob, ScrapeParams, SourceAdapter } from '../scraper.types';

export const REMOTIVE_API = 'https://www.remotive.com/api/remote-jobs';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

export interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export function parseRemotive(payload: RemotiveResponse, params: ScrapeParams): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const job of payload.jobs ?? []) {
    if (!job.url || !job.title) continue;
    const location = job.candidate_required_location ?? '';
    const description = stripHtml(job.description ?? '', 600);
    const text = `${job.title} ${job.company_name ?? ''} ${description}`;
    const normalized: NormalizedJob = {
      sourceId: 'remotive',
      sourceName: 'Remotive',
      title: job.title.trim(),
      company: (job.company_name ?? 'Unknown').trim(),
      location: location || 'Remote',
      country: primaryCountry(location, params.countries),
      description,
      url: job.url,
      postedAt: new Date(job.publication_date ?? Date.now()),
      remoteType: toRemoteType(location, true),
      jobType: toJobType(job.job_type),
      experienceLevel: toExperienceLevel(job.title),
      skills: extractSkills(text, job.tags ?? []),
      salary: parseSalary(job.salary),
      applyMethod: 'external',
    };
    if (!passesFilters(normalized, params)) continue;
    jobs.push(normalized);
  }
  return jobs;
}

export const remotiveScraper: SourceAdapter = {
  id: 'remotive',
  name: 'Remotive',
  async scrape(params) {
    const search = params.keywords.length
      ? `?search=${encodeURIComponent(params.keywords[0])}`
      : '';
    const url = `${REMOTIVE_API}${search}`;
    await canFetch(url);
    const payload = await fetchJson<RemotiveResponse>(url);
    return parseRemotive(payload, params).slice(0, 40);
  },
};
