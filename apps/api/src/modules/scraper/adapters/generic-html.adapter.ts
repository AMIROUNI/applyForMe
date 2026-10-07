import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
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
import { absoluteUrl, parsePostDate } from './generic-common';
import type { NormalizedJob, RegistrySource, ScrapeParams, SourceAdapter } from '../scraper.types';

const MAX_JOBS = 40;

type JsonLd = Record<string, unknown>;
type HtmlSelectors = Record<string, string | undefined>;

const JOB_PATH =
  /(job|offre|emploi|vacanc|career|stelle|empleo|position|opening|offer|annonce|detail)/i;
const NOISE_LINK =
  /^(read more|learn more|more info|more info\.|more details|details?|view|apply( now)?|postuler( maintenant)?|voir plus|plus d['’]infos?|job details?|click here)$/i;

const CLASS_HINTS = ['job', 'vacanc', 'offre', 'emploi', 'stelle', 'empleo', 'opening', 'position'];
const COMPANY_HINTS = ['company', 'employer', 'firma', 'societe', 'organisation', 'organization'];
const LOCATION_HINTS = ['location', 'lieu', 'city', 'ort', 'ville', 'region', 'country', 'pays'];
const DATE_HINTS = ['date', 'published', 'posted', 'zeit', 'fecha'];

const asRecord = (value: unknown): JsonLd | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonLd) : null;

const jobPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const asString = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim()
    : value === null || value === undefined
      ? ''
      : String(value);

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

function scopeText($: CheerioAPI, scope: Cheerio<AnyNode>, selector?: string): string {
  if (!selector) return '';
  return normalize(scope.find(selector).first().text());
}

function textByClass($: CheerioAPI, scope: Cheerio<AnyNode>, hints: string[]): string {
  let found = '';
  scope.find('*').each((_, element) => {
    if (found) return;
    const className = ($(element).attr('class') ?? '').toLowerCase();
    if (!hints.some(hint => className.includes(hint))) return;
    const text = normalize($(element).text());
    if (text) found = text;
  });
  return found;
}

// ---------------------------------------------------------------- JSON-LD

function collectJsonLd($: CheerioAPI): JsonLd[] {
  const nodes: JsonLd[] = [];
  const push = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    const record = asRecord(value);
    if (!record) return;
    nodes.push(record);
    if (record['@graph']) push(record['@graph']);
  };

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      push(JSON.parse($(element).text()));
    } catch {
      // malformed block -> ignore, the page may carry several
    }
  });
  return nodes;
}

function jsonLdLocation(node: JsonLd): string {
  const single = (value: unknown): string => {
    const record = asRecord(value);
    if (!record) return asString(value);
    const address = asRecord(record['address']) ?? record;
    return ['addressLocality', 'addressRegion', 'addressCountry']
      .map(key => asString(address[key]))
      .filter(Boolean)
      .join(', ');
  };

  const primary = single(node['jobLocation']);
  if (primary) return primary;

  const requirements = node['applicantLocationRequirements'];
  if (Array.isArray(requirements)) return requirements.map(single).filter(Boolean).join(', ');
  return single(requirements);
}

function jsonLdSalary(node: JsonLd): NormalizedJob['salary'] {
  const salary = asRecord(node['baseSalary']);
  if (!salary) return null;
  const value = asRecord(salary['value']);
  const min =
    typeof value?.['minValue'] === 'number'
      ? value['minValue']
      : typeof value?.['value'] === 'number'
        ? value['value']
        : null;
  const max = typeof value?.['maxValue'] === 'number' ? value['maxValue'] : null;
  if (min === null && max === null) return null;

  const unit = asString(value?.['unitText'] ?? salary['unitText'] ?? 'year').toLowerCase();
  const period = unit.startsWith('hour') ? 'hour' : unit.startsWith('month') ? 'month' : 'year';
  return {
    min: min ?? 0,
    max: max ?? 0,
    currency: asString(salary['currency']) || 'USD',
    period,
  };
}

export function parseJsonLdJobs(
  html: string,
  source: RegistrySource,
  params: ScrapeParams
): NormalizedJob[] {
  const $ = load(html);
  const jobs: NormalizedJob[] = [];

  for (const node of collectJsonLd($)) {
    const type = node['@type'];
    const isJob = type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
    if (!isJob) continue;

    const title = asString(node['headline'] ?? node['title']);
    if (!title) continue;

    const organization = asRecord(node['hiringOrganization']);
    const company = asString(organization?.['name']) || 'Unknown';
    const location = jsonLdLocation(node);
    const mainEntity = asRecord(node['mainEntityOfPage']) ?? node['mainEntityOfPage'];
    const rawUrl = asString(node['url'] ?? asString(asRecord(mainEntity)?.['@id'] ?? mainEntity));
    const url = absoluteUrl(rawUrl, source.baseUrl) || source.baseUrl;
    const description = stripHtml(asString(node['description']), 600);
    const telework = asString(node['jobLocationType']).toUpperCase() === 'TELECOMMUTE';

    const job: NormalizedJob = {
      sourceId: source.id,
      sourceName: source.name,
      title,
      company,
      location,
      country: primaryCountry(`${location} ${asString(node['jobLocationType'])}`, params.countries),
      description,
      url,
      postedAt: parsePostDate(node['datePosted']),
      remoteType: telework ? 'remote' : toRemoteType(location, source.remoteFriendly),
      jobType: 'all',
      experienceLevel: toExperienceLevel(title),
      skills: extractSkills(`${title} ${description}`),
      salary: jsonLdSalary(node),
      applyMethod: 'external',
    };
    if (!passesFilters(job, params)) continue;
    jobs.push(job);
  }

  return jobs;
}

// ------------------------------------------------------------- selectors

export function parseSelectorJobs(
  html: string,
  source: RegistrySource,
  selectors: HtmlSelectors,
  params: ScrapeParams
): NormalizedJob[] {
  const itemSelector = selectors['item'];
  const titleSelector = selectors['title'];
  if (!itemSelector || !titleSelector) return [];

  const $ = load(html);
  const jobs: NormalizedJob[] = [];

  $(itemSelector).each((_, element) => {
    const item = $(element);
    const title = scopeText($, item, titleSelector);
    if (!title) return;

    let link = item.find(selectors['link'] ?? 'a').first();
    if (!link.attr('href')) link = link.find('a').first();
    const url = absoluteUrl(link.attr('href'), source.baseUrl);
    if (!url) return;

    const company = scopeText($, item, selectors['company']) || 'Unknown';
    const location = scopeText($, item, selectors['location']);
    const description = stripHtml(scopeText($, item, selectors['description']), 600);
    const postedAt = parsePostDate(scopeText($, item, selectors['date']) || undefined);

    const job: NormalizedJob = {
      sourceId: source.id,
      sourceName: source.name,
      title,
      company,
      location,
      country: primaryCountry(location, params.countries),
      description,
      url,
      postedAt,
      remoteType: toRemoteType(location, source.remoteFriendly),
      jobType: 'all',
      experienceLevel: toExperienceLevel(title),
      skills: extractSkills(`${title} ${description}`),
      salary: null,
      applyMethod: 'external',
    };
    if (!passesFilters(job, params)) return;
    jobs.push(job);
  });

  return jobs;
}

// ------------------------------------------------------------ heuristics

function candidateElements($: CheerioAPI): Element[] {
  const candidates: Element[] = $('article, li').toArray();
  if (candidates.length) return candidates;

  return $('div, section')
    .toArray()
    .filter(element => {
      const className = ($(element).attr('class') ?? '').toLowerCase();
      return CLASS_HINTS.some(hint => className.includes(hint));
    });
}

export function parseHeuristicJobs(
  html: string,
  source: RegistrySource,
  params: ScrapeParams
): NormalizedJob[] {
  const $ = load(html);
  const jobs: NormalizedJob[] = [];
  const seen = new Set<string>();

  for (const element of candidateElements($)) {
    if (jobs.length >= MAX_JOBS) break;
    const scope = $(element);

    let link = '';
    let title = '';
    scope.find('a[href]').each((_, anchor) => {
      if (title) return;
      const text = normalize($(anchor).text());
      const href = ($(anchor).attr('href') ?? '').trim();
      if (text.length < 6 || NOISE_LINK.test(text)) return;
      if (/^(#|javascript:|mailto:)/i.test(href)) return;
      if (/\.(jpe?g|png|svg|gif|pdf|zip)$/i.test(href)) return;
      title = text;
      link = href;
    });
    if (!title || !link) continue;

    const url = absoluteUrl(link, source.baseUrl);
    if (!url || seen.has(url)) continue;

    const company = textByClass($, scope, COMPANY_HINTS) || 'Unknown';
    const location = textByClass($, scope, LOCATION_HINTS);
    const dateText = textByClass($, scope, DATE_HINTS);
    let description = '';
    scope.find('p').each((_, paragraph) => {
      if (description) return;
      const text = normalize($(paragraph).text());
      if (text.length > 40) description = text;
    });

    // Job boards live on job-ish hostnames, so the gate only reads the path.
    if (company === 'Unknown' && !JOB_PATH.test(jobPath(url))) continue;

    const normalizedTitle = normalize(title);
    const job: NormalizedJob = {
      sourceId: source.id,
      sourceName: source.name,
      title: normalizedTitle,
      company,
      location,
      country: primaryCountry(location, params.countries),
      description: stripHtml(description, 600),
      url,
      postedAt: parsePostDate(dateText || undefined),
      remoteType: toRemoteType(location, source.remoteFriendly),
      jobType: 'all',
      experienceLevel: toExperienceLevel(normalizedTitle),
      skills: extractSkills(`${normalizedTitle} ${description}`),
      salary: null,
      applyMethod: 'external',
    };
    if (!passesFilters(job, params)) continue;
    seen.add(url);
    jobs.push(job);
  }

  return jobs;
}

// ------------------------------------------------------------- pipeline

/**
 * Extraction order: explicit `config.selectors` (user-provided) win, then
 * schema.org JobPosting JSON-LD, then markup heuristics. First non-empty
 * strategy wins so a page is not mined twice with different rules.
 */
export function parseGenericHtml(
  html: string,
  source: RegistrySource,
  config: Record<string, unknown>,
  params: ScrapeParams
): NormalizedJob[] {
  const selectors = config['selectors'] as HtmlSelectors | undefined;
  const strategies: Array<() => NormalizedJob[]> = [];

  if (selectors?.['item'] && selectors?.['title']) {
    strategies.push(() => parseSelectorJobs(html, source, selectors, params));
  }
  strategies.push(() => parseJsonLdJobs(html, source, params));
  strategies.push(() => parseHeuristicJobs(html, source, params));

  for (const strategy of strategies) {
    const jobs = strategy();
    if (jobs.length) return dedupe(jobs).slice(0, MAX_JOBS);
  }
  return [];
}

const dedupe = (jobs: NormalizedJob[]): NormalizedJob[] => {
  const seen = new Set<string>();
  return jobs.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
};

export function createHtmlAdapter(source: RegistrySource): SourceAdapter {
  const listUrl = typeof source.config['endpoint'] === 'string' ? source.config['endpoint'] : '';
  const target = listUrl || source.baseUrl;

  return {
    id: source.id,
    name: source.name,
    async scrape(params) {
      await canFetch(target);
      const html = await fetchText(target);
      return parseGenericHtml(html, source, source.config, params);
    },
  };
}
