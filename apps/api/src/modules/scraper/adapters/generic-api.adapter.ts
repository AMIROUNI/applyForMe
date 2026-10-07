import { canFetch } from '../robots';
import { fetchJson } from '../http';
import {
  extractSkills,
  passesFilters,
  primaryCountry,
  stripHtml,
  toExperienceLevel,
  toRemoteType,
} from '../normalize';
import { absoluteUrl, parsePostDate } from './generic-common';
import type { NormalizedJob, RegistrySource, ScrapeParams, SourceAdapter } from '../scraper.types';

const MAX_JOBS = 40;

/** Payload keys commonly wrapping the actual list of results. */
const LIST_KEYS = [
  'jobs',
  'results',
  'data',
  'hits',
  'items',
  'offers',
  'offres',
  'vacancies',
  'listings',
];

/** Fallback field guesses when the registry has no `fieldMap`. */
const FIELD_GUESSES: Record<string, string[]> = {
  title: ['title', 'name', 'jobTitle', 'intitule', 'label', 'headline'],
  company: [
    'company',
    'companyName',
    'hiringOrganization',
    'employer',
    'entreprise',
    'organization',
  ],
  url: ['url', 'link', 'jobUrl', 'href', 'absolute_url', 'detailUrl', 'jobUrl'],
  location: ['location', 'lieu', 'city', 'jobLocation', 'place', 'region', 'address'],
  postedAt: [
    'postedAt',
    'date',
    'publishedAt',
    'createdAt',
    'created_at',
    'datePublication',
    'publicationDate',
  ],
  description: ['description', 'summary', 'snippet', 'excerpt', 'body'],
};

const isRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function getPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(/[.[\]]+/).filter(Boolean)) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function findList(payload: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  const record = isRecord(payload);
  if (!record || depth > 3) return null;

  for (const key of LIST_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  for (const value of Object.values(record)) {
    const nested = findList(value, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function readField(entry: Record<string, unknown>, path: string): unknown {
  return getPath(entry, path);
}

function firstField(entry: Record<string, unknown>, guesses: string[]): unknown {
  for (const key of guesses) {
    const value = entry[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return typeof record['name'] === 'string' ? record['name'].trim() : '';
  }
  return '';
}

/**
 * Maps one API entry to a job. Entries without a title, and without either a
 * link or a company, are dropped — that keeps thread-style payloads (e.g. the
 * HN hiring thread) from activating a source with junk rows.
 */
export function parseApiPayload(
  payload: unknown,
  source: RegistrySource,
  params: ScrapeParams
): NormalizedJob[] {
  const list = findList(payload);
  if (!list) return [];

  const fieldMap = isRecord(source.config['fieldMap']) ?? undefined;
  const pick = (entry: Record<string, unknown>, field: string): unknown =>
    fieldMap && typeof fieldMap[field] === 'string'
      ? readField(entry, fieldMap[field] as string)
      : firstField(entry, FIELD_GUESSES[field]);

  const jobs: NormalizedJob[] = [];

  for (const raw of list) {
    if (jobs.length >= MAX_JOBS) break;
    const entry = isRecord(raw);
    if (!entry) continue;

    const title = toText(pick(entry, 'title'));
    if (title.length < 2) continue;

    const urlValue = pick(entry, 'url');
    const url = absoluteUrl(toText(urlValue) || undefined, source.baseUrl);
    const company = toText(pick(entry, 'company')) || 'Unknown';
    if (!url && company === 'Unknown') continue;

    const location = toText(pick(entry, 'location'));
    const description = stripHtml(toText(pick(entry, 'description')), 600);

    const job: NormalizedJob = {
      sourceId: source.id,
      sourceName: source.name,
      title,
      company,
      location,
      country: primaryCountry(location, params.countries),
      description,
      url: url || source.baseUrl,
      postedAt: parsePostDate(pick(entry, 'postedAt')),
      remoteType: toRemoteType(location, source.remoteFriendly),
      jobType: 'all',
      experienceLevel: toExperienceLevel(title),
      skills: extractSkills(`${title} ${description}`),
      salary: null,
      applyMethod: 'external',
    };
    if (!passesFilters(job, params)) continue;
    jobs.push(job);
  }

  return jobs;
}

export function createApiAdapter(source: RegistrySource): SourceAdapter {
  return {
    id: source.id,
    name: source.name,
    async scrape(params) {
      const endpoint = String(source.config['endpoint'] ?? '');
      if (!endpoint) return [];

      const url = new URL(endpoint);
      const query = isRecord(source.config['query']);
      if (query) {
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
        }
      }

      await canFetch(url.toString());
      const payload = await fetchJson<unknown>(url.toString());
      return parseApiPayload(payload, source, params);
    },
  };
}
