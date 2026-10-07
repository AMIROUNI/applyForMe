import type { SourceAddedBy, SourceConfig, SourceStatus, SourceType } from '@agency-apply/shared';

export type SeedSource = {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  type: SourceType;
  countries: string[];
  categories: string[];
  remoteFriendly: boolean;
  status: SourceStatus;
  config: SourceConfig;
  requiresUserToken: boolean;
  addedBy: SourceAddedBy;
};

const system = (source: Omit<SeedSource, 'addedBy'>): SeedSource => ({
  ...source,
  addedBy: 'system',
});

/**
 * Starter registry. `active` entries have a working adapter today; the rest
 * activate through `POST /sources/:id/validate` as soon as their adapter
 * returns enough jobs - generic html/rss/api adapters (Phase 2) cover most of
 * them, the Apify connector (Phase 3) runs the `apify` types once the user
 * connects their token, and AI discovery (Phase 4) adds country-specific
 * `pending` sources through `POST /sources/discover` (`ai_extract` itself
 * stays unsupported by design - the model only proposes, deterministic
 * adapters scrape).
 */
export const SOURCE_SEED: SeedSource[] = [
  // ---- Active: existing bespoke adapters --------------------------------
  system({
    id: 'remotive',
    name: 'Remotive',
    description: 'Remote-only job board with a public JSON API.',
    baseUrl: 'https://www.remotive.com',
    type: 'api',
    countries: ['*'],
    categories: ['tech', 'remote'],
    remoteFriendly: true,
    status: 'active',
    config: {
      adapterId: 'remotive',
      endpoint: 'https://www.remotive.com/api/remote-jobs',
    },
    requiresUserToken: false,
  }),
  system({
    id: 'remoteok',
    name: 'RemoteOK',
    description: 'Public JSON API for remote positions worldwide.',
    baseUrl: 'https://remoteok.com',
    type: 'api',
    countries: ['*'],
    categories: ['tech', 'remote'],
    remoteFriendly: true,
    status: 'active',
    config: {
      adapterId: 'remoteok',
      endpoint: 'https://remoteok.com/api',
    },
    requiresUserToken: false,
  }),
  system({
    id: 'arbeitnow',
    name: 'Arbeitnow',
    description: 'Public job board API, strong on Germany and Europe.',
    baseUrl: 'https://www.arbeitnow.com',
    type: 'api',
    countries: ['*'],
    categories: ['general'],
    remoteFriendly: true,
    status: 'active',
    config: {
      adapterId: 'arbeitnow',
      endpoint: 'https://www.arbeitnow.com/api/job-board-api',
    },
    requiresUserToken: false,
  }),
  system({
    id: 'weworkremotely',
    name: 'We Work Remotely',
    description: 'Remote work job board, read through its RSS category feeds.',
    baseUrl: 'https://weworkremotely.com',
    type: 'rss',
    countries: ['*'],
    categories: ['tech', 'remote'],
    remoteFriendly: true,
    status: 'active',
    config: {
      adapterId: 'weworkremotely',
      feedUrls: [
        'https://weworkremotely.com/categories/remote-programming-jobs.rss',
        'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
        'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
      ],
    },
    requiresUserToken: false,
  }),

  // ---- Apify-only sources (anti-bot / no public API) --------------------
  system({
    id: 'linkedin',
    name: 'LinkedIn Jobs',
    description: 'Fetched through your own Apify account — LinkedIn forbids direct scraping.',
    baseUrl: 'https://www.linkedin.com/jobs',
    type: 'apify',
    countries: ['*'],
    categories: ['general', 'tech'],
    remoteFriendly: true,
    status: 'pending',
    // Actor id is configurable and must be verified when the connector ships.
    config: { apifyActorId: 'apify/linkedin-jobs-scraper' },
    requiresUserToken: true,
  }),
  system({
    id: 'linkedin-posts',
    name: 'LinkedIn hiring posts',
    description: 'Hiring posts and announcements, stored as posts instead of jobs.',
    baseUrl: 'https://www.linkedin.com/feed',
    type: 'apify',
    countries: ['*'],
    categories: ['general'],
    remoteFriendly: true,
    status: 'pending',
    config: { apifyActorId: 'apify/linkedin-posts-scraper' },
    requiresUserToken: true,
  }),
  system({
    id: 'indeed',
    name: 'Indeed',
    description: 'Fetched through your own Apify account — Indeed forbids direct scraping.',
    baseUrl: 'https://www.indeed.com',
    type: 'apify',
    countries: ['*'],
    categories: ['general'],
    remoteFriendly: true,
    status: 'pending',
    config: { apifyActorId: 'apify/indeed-scraper' },
    requiresUserToken: true,
  }),
  system({
    id: 'glassdoor',
    name: 'Glassdoor',
    description: 'Reviews and listings through your own Apify account.',
    baseUrl: 'https://www.glassdoor.com',
    type: 'apify',
    countries: ['*'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: { apifyActorId: 'apify/glassdoor-scraper' },
    requiresUserToken: true,
  }),

  // ---- FR ---------------------------------------------------------------
  system({
    id: 'france-travail',
    name: 'France Travail',
    description: 'Official French employment API (free account required).',
    baseUrl: 'https://francetravail.io',
    type: 'api',
    countries: ['fr'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {
      endpoint: 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search',
    },
    requiresUserToken: true,
  }),
  system({
    id: 'apec',
    name: 'APEC',
    description: 'French executive and professional job board.',
    baseUrl: 'https://www.apec.fr',
    type: 'html',
    countries: ['fr'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),
  system({
    id: 'welcometothejungle',
    name: 'Welcome to the Jungle',
    description: 'Company-driven job board exposing schema.org JobPosting JSON-LD.',
    baseUrl: 'https://www.welcometothjungle.com',
    type: 'html',
    countries: ['fr', 'be'],
    categories: ['tech', 'general'],
    remoteFriendly: true,
    status: 'pending',
    config: { preferJsonLd: true },
    requiresUserToken: false,
  }),

  // ---- TN ---------------------------------------------------------------
  system({
    id: 'emploi-nat-tn',
    name: 'Emploi.nat.tn',
    description: 'Tunisian employment portal (session-based HTML, needs validation).',
    baseUrl: 'https://www.emploi.nat.tn',
    type: 'html',
    countries: ['tn'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),
  system({
    id: 'tanitjobs',
    name: 'TanitJobs',
    description: 'Tunisian job board behind an anti-bot challenge — not scraped directly.',
    baseUrl: 'https://www.tanitjobs.net',
    type: 'html',
    countries: ['tn'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'disabled',
    config: {},
    requiresUserToken: false,
  }),
  system({
    id: 'keepjob',
    name: 'KeepJob',
    description: 'Tunisian job board — domain retired.',
    baseUrl: 'https://www.keepjob.com',
    type: 'html',
    countries: ['tn'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'disabled',
    config: {},
    requiresUserToken: false,
  }),

  // ---- MA ---------------------------------------------------------------
  system({
    id: 'rekrute',
    name: 'Rekrute',
    description: 'Leading Moroccan job board.',
    baseUrl: 'https://www.rekrute.com',
    type: 'html',
    countries: ['ma'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- DZ ---------------------------------------------------------------
  system({
    id: 'emploitic',
    name: 'EmploiTIC',
    description: 'Algerian tech and IT job listings.',
    baseUrl: 'https://www.emploitic.com',
    type: 'html',
    countries: ['dz'],
    categories: ['tech'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- EG ---------------------------------------------------------------
  system({
    id: 'wuzzuf',
    name: 'Wuzzuf',
    description: 'Egyptian job marketplace exposing schema.org JobPosting JSON-LD.',
    baseUrl: 'https://wuzzuf.net',
    type: 'html',
    countries: ['eg'],
    categories: ['general', 'tech'],
    remoteFriendly: false,
    status: 'pending',
    config: { preferJsonLd: true },
    requiresUserToken: false,
  }),
  system({
    id: 'forasna',
    name: 'Forasna',
    description: 'Arabic-language job portal across Egypt and the Gulf.',
    baseUrl: 'https://www.forasna.com',
    type: 'html',
    countries: ['eg', 'sa', 'ae'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- DE ---------------------------------------------------------------
  system({
    id: 'stepstone-de',
    name: 'StepStone DE',
    description: 'German job board with sitemap and JSON-LD listings.',
    baseUrl: 'https://www.stepstone.de',
    type: 'html',
    countries: ['de'],
    categories: ['general'],
    remoteFriendly: true,
    status: 'pending',
    config: { preferJsonLd: true },
    requiresUserToken: false,
  }),
  system({
    id: 'berlinstartupjobs',
    name: 'Berlin Startup Jobs',
    description: 'Startup roles in Germany, RSS-friendly.',
    baseUrl: 'https://berlinstartupjobs.com',
    type: 'rss',
    countries: ['de'],
    categories: ['tech'],
    remoteFriendly: true,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- GB ---------------------------------------------------------------
  system({
    id: 'reed',
    name: 'reed.co.uk',
    description: 'UK job board with JSON-LD job listings.',
    baseUrl: 'https://www.reed.co.uk',
    type: 'html',
    countries: ['gb'],
    categories: ['general'],
    remoteFriendly: true,
    status: 'pending',
    config: { preferJsonLd: true },
    requiresUserToken: false,
  }),
  system({
    id: 'totaljobs',
    name: 'TotalJobs',
    description: 'UK generalist job board.',
    baseUrl: 'https://www.totaljobs.com',
    type: 'html',
    countries: ['gb'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- ES ---------------------------------------------------------------
  system({
    id: 'infojobs',
    name: 'InfoJobs',
    description: 'Spanish job board, largest in the market.',
    baseUrl: 'https://www.infojobs.net',
    type: 'html',
    countries: ['es'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- US / CA ----------------------------------------------------------
  system({
    id: 'usajobs',
    name: 'USAJOBS',
    description: 'Official US federal job API (free Authorization-Key required).',
    baseUrl: 'https://www.usajobs.gov',
    type: 'api',
    countries: ['us'],
    categories: ['government'],
    remoteFriendly: false,
    status: 'pending',
    config: {
      endpoint: 'https://data.usajobs.gov/api/search',
      authHeader: 'Authorization-Key',
    },
    requiresUserToken: true,
  }),
  system({
    id: 'hn-hiring',
    name: 'Hacker News “Who is hiring”',
    description: 'Public Algolia API over the monthly “Ask HN: Who is hiring” threads.',
    baseUrl: 'https://news.ycombinator.com',
    type: 'api',
    countries: ['*'],
    categories: ['tech'],
    remoteFriendly: true,
    status: 'pending',
    config: {
      endpoint: 'https://hn.algolia.com/api/v1/search',
      query: { query: 'Ask HN: Who is hiring', tags: 'story' },
    },
    requiresUserToken: false,
  }),
  system({
    id: 'jobbank-canada',
    name: 'Job Bank',
    description: 'Official Government of Canada job bank.',
    baseUrl: 'https://www.jobbank.gc.ca',
    type: 'html',
    countries: ['ca'],
    categories: ['government', 'general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- AE / SA (MENA) ---------------------------------------------------
  system({
    id: 'bayt',
    name: 'Bayt',
    description: 'Largest job board in the Middle East and North Africa.',
    baseUrl: 'https://www.bayt.com',
    type: 'html',
    countries: ['ae', 'sa', 'eg', 'ma', 'jo', 'qa', 'kw', 'om', 'bh'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),
  system({
    id: 'gulftalent',
    name: 'GulfTalent',
    description: 'Professional recruitment across the Gulf region.',
    baseUrl: 'https://www.gulftalent.com',
    type: 'html',
    countries: ['ae', 'sa', 'qa', 'kw', 'om', 'bh'],
    categories: ['general'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),
  system({
    id: 'wamda',
    name: 'Wamda',
    description: 'MENA startup ecosystem news and job listings.',
    baseUrl: 'https://wamda.com',
    type: 'html',
    countries: ['ae', 'sa', 'eg', 'jo', 'lb', 'ma'],
    categories: ['tech'],
    remoteFriendly: false,
    status: 'pending',
    config: {},
    requiresUserToken: false,
  }),

  // ---- Disabled upstream ------------------------------------------------
  system({
    id: 'jobicy',
    name: 'Jobicy',
    description: 'Remote job API — no longer publicly accessible.',
    baseUrl: 'https://jobicy.com',
    type: 'api',
    countries: ['*'],
    categories: ['remote'],
    remoteFriendly: true,
    status: 'disabled',
    config: {},
    requiresUserToken: false,
  }),
];

export const ACTIVE_SEED_IDS = SOURCE_SEED.filter(source => source.status === 'active').map(
  source => source.id
);
