import type {
  ExperienceLevel,
  JobType,
  NormalizedJob,
  RemoteType,
  ScrapeParams,
} from './scraper.types';

export type Salary = NormalizedJob['salary'];

export const foldAccents = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const COUNTRY_PATTERNS: Array<[RegExp, string]> = [
  [/\btunisia|\btunisie|\btunis\b/, 'tn'],
  [/\bfrance|\bparis|\blyon\b/, 'fr'],
  [/\bmorocco|\bmaroc|\bcasablanca|\bmarrakech/, 'ma'],
  [/\balgeria|\balgerie|\balgiers\b/, 'dz'],
  [/\bunited states|\busa\b|\bu\.s\.a?\b|\bnew york|\bsan francisco/, 'us'],
  [/\bnorth america/, 'us'],
  [/\bnorth america/, 'ca'],
  [/\bunited kingdom|\bengland|\blondon\b|\buk\b|\bgreat britain/, 'gb'],
  [/\bgermany|\bberlin|\bmunich|\bdeutschland/, 'de'],
  [/\bcanada|\btoronto|\bvancouver|\bmontreal/, 'ca'],
  [/\bunited arab emirates|\buae\b|\bdubai|\babu dhabi/, 'ae'],
  [/\bnetherlands|\bams?terdam|\bholland/, 'nl'],
  [/\bspain|\bmadrid|\bbarcelona/, 'es'],
  [/\bitaly|\bitalia|\brome\b|\bmilan/, 'it'],
  [/\bindia|\bbangalore|\bmumbai|\bdelhi\b/, 'in'],
  [/\baustralia|\bsydney|\bmelbourne/, 'au'],
  [/\bbrazil|\bsao paulo|\brio de janeiro/, 'br'],
];

/** All country codes mentioned in a free-text location string. */
export function toCountries(text: string): string[] {
  const haystack = foldAccents(text);
  const found = COUNTRY_PATTERNS.filter(([pattern]) => pattern.test(haystack)).map(
    ([, code]) => code
  );
  return [...new Set(found)];
}

/**
 * Primary country for a job. When the user filters by countries, prefer the
 * requested one so later dashboard filtering keeps the job visible.
 */
export function primaryCountry(text: string, requested: string[]): string {
  const found = toCountries(text);
  if (!found.length) return '';
  return requested.find(code => found.includes(code)) ?? found[0];
}

const isRemoteLocation = (text: string): boolean =>
  /\bremote\b|\bworldwide\b|\banywhere\b|\bwork from home\b|\bteletravail\b|\bglobal\b|\bany location\b/.test(
    foldAccents(text)
  );

export function toRemoteType(location: string, sourceIsRemote: boolean): RemoteType {
  if (sourceIsRemote || isRemoteLocation(location)) return 'remote';
  if (!location) return 'onsite';
  if (/\bhybrid\b/.test(foldAccents(location))) return 'hybrid';
  return 'onsite';
}

export function toJobType(raw: string | undefined): JobType {
  const value = foldAccents(raw ?? '');
  if (value.includes('part')) return 'part-time';
  if (value.includes('contract') || value.includes('freelance') || value.includes('temp')) {
    return 'contract';
  }
  if (value.includes('intern')) return 'internship';
  if (value.includes('full')) return 'full-time';
  return 'all';
}

export function toExperienceLevel(title: string): ExperienceLevel {
  const value = foldAccents(title);
  if (/\b(intern|internship|stagiaire)\b/.test(value)) return 'entry';
  if (/\b(junior|graduate|entry|beginner|0-2 years)\b/.test(value)) return 'entry';
  if (/\b(head of|director|vp|chief|ceo|cto|coo|cfo)\b/.test(value)) return 'executive';
  if (/\b(senior|sr\.?|expert|5\+ years)\b/.test(value)) return 'senior';
  if (/\b(lead|principal|staff|manager|architect)\b/.test(value)) return 'lead';
  if (/\b(mid|intermediate)\b/.test(value)) return 'mid';
  return 'all';
}

const SKILL_PATTERNS = [
  'react',
  'angular',
  'vue',
  'next\\.?js',
  'nuxt',
  'node\\.?js',
  'express',
  'nest\\.?js',
  'typescript',
  'javascript',
  'python',
  'django',
  'flask',
  'fastapi',
  'java',
  'spring',
  'kotlin',
  'swift',
  'go(?:lang)?',
  'rust',
  'php',
  'laravel',
  'ruby',
  'rails',
  '\\.net',
  'c\\+\\+',
  'sql',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'graphql',
  'rest\\s?api',
  'aws',
  'azure',
  'gcp',
  'docker',
  'kubernetes',
  'terraform',
  'linux',
  'git',
  'html',
  'css',
  'tailwind',
  'sass',
  'flutter',
  'react native',
  'android',
  'ios',
  'machine learning',
  'tensorflow',
  'pytorch',
  'data engineering',
  'airflow',
  'spark',
  'salesforce',
  'sap',
  'wordpress',
  'shopify',
  'figma',
  'product management',
];

const skillRegex = new RegExp(`(?:^|[^a-z])(${SKILL_PATTERNS.join('|')})(?![a-z])`, 'gi');

export function extractSkills(text: string, extra: string[] = [], limit = 8): string[] {
  const found = new Set<string>();
  for (const tag of extra) {
    const clean = tag.trim().toLowerCase();
    if (clean && clean.length <= 30) found.add(clean);
  }
  const haystack = foldAccents(text);
  let match: RegExpExecArray | null;
  skillRegex.lastIndex = 0;
  while ((match = skillRegex.exec(haystack)) !== null && found.size < limit) {
    found.add(match[1].toLowerCase());
  }
  return [...found].slice(0, limit);
}

export function stripHtml(html: string, maxLength = 600): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

/** Case- and accent-insensitive keyword match against a blob of text. */
export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const haystack = foldAccents(text);
  return keywords.some(keyword => haystack.includes(foldAccents(keyword)));
}

export function countKeywordHits(text: string, keywords: string[]): string[] {
  const haystack = foldAccents(text);
  return keywords.filter(keyword => haystack.includes(foldAccents(keyword)));
}

export interface ScoredMatch {
  matchScore: number;
  matchReason: string;
}

export function scoreJob(title: string, body: string, keywords: string[]): ScoredMatch {
  if (!keywords.length) {
    return { matchScore: 70, matchReason: 'Default score - no keywords given' };
  }
  const titleHits = countKeywordHits(title, keywords);
  const bodyHits = countKeywordHits(body, keywords).filter(k => !titleHits.includes(k));
  const matched = new Set([...titleHits, ...bodyHits]);
  const ratio = matched.size / keywords.length;
  const score = Math.min(99, Math.round(40 + 50 * ratio + (titleHits.length ? 10 : 0)));
  const matchReason = matched.size
    ? `Matches keyword${matched.size > 1 ? 's' : ''}: ${[...matched].join(', ')}`
    : 'No keyword match';
  return { matchScore: score, matchReason };
}

const SALARY_RANGE =
  /(?:[$\u20ac\u00a3]|usd\s?|eur\s?)?\s*(\d[\d,.]*)\s*(k)?\s*[$\u20ac\u00a3]?\s*(?:-|\u2013|to)\s*(?:[$\u20ac\u00a3]|usd\s?|eur\s?)?\s*(\d[\d,.]*)\s*(k)?\s*[$\u20ac\u00a3]?/i;

export function parseSalary(raw: string | null | undefined): Salary {
  if (!raw) return null;
  const match = SALARY_RANGE.exec(raw);
  if (!match) return null;
  const scale = (value: string, k?: string): number => {
    const n = Number(value.replace(/,/g, ''));
    if (Number.isNaN(n)) return NaN;
    return k ? n * 1000 : n;
  };
  const min = scale(match[1], match[2]);
  const max = scale(match[3], match[4]);
  if (Number.isNaN(min) || Number.isNaN(max) || min <= 0 || max <= 0) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('day') && !lower.includes('month')) return null;
  const period =
    lower.includes('hour') || lower.includes('/hr')
      ? 'hour'
      : lower.includes('month')
        ? 'month'
        : 'year';
  const currency =
    raw.includes('\u20ac') || lower.includes('eur')
      ? 'EUR'
      : raw.includes('\u00a3')
        ? 'GBP'
        : 'USD';
  return { min, max, currency, period };
}

export function toEpochDate(value: number | string | undefined | null): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // RemoteOK uses seconds, Arbeitnow uses milliseconds.
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? new Date() : new Date(parsed);
}

export function withinCountries(jobCountries: string[], requested: string[]): boolean {
  if (!requested.length) return true;
  return jobCountries.some(code => requested.includes(code));
}

export function passesFilters(job: NormalizedJob, params: ScrapeParams): boolean {
  if (params.remoteOnly && job.remoteType !== 'remote') return false;
  if (params.countries.length) {
    const found = toCountries(`${job.location} ${job.country}`);
    if (!params.countries.some(code => found.includes(code))) return false;
  }
  const text = `${job.title} ${job.company} ${job.description} ${job.skills.join(' ')}`;
  return matchesKeywords(text, params.keywords);
}
