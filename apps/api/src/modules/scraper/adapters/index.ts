import type { SourceConfig, SourceType } from '@agency-apply/shared';
import type { SourceAdapter } from '../scraper.types';
import { remotiveScraper } from './remotive.adapter';
import { remoteOkScraper } from './remoteok.adapter';
import { arbeitnowScraper } from './arbeitnow.adapter';
import { wwrScraper } from './weworkremotely.adapter';

export const SOURCE_ADAPTERS: SourceAdapter[] = [
  remotiveScraper,
  remoteOkScraper,
  arbeitnowScraper,
  wwrScraper,
];

export const adapterById = new Map(SOURCE_ADAPTERS.map(adapter => [adapter.id, adapter]));

/** Known sources we intentionally do not scrape (rules.md / unavailable upstream). */
export const UNSUPPORTED_SOURCES: Record<string, string> = {
  linkedin: 'LinkedIn forbids automated scraping',
  indeed: 'Indeed forbids automated scraping',
  tanitjobs: 'Protected by anti-bot challenge',
  keepjob: 'Domain retired',
  emploi_nat_tn: 'Legacy session-based site, not supported yet',
  jobicy: 'API no longer publicly accessible',
};

export const DEFAULT_SOURCES = SOURCE_ADAPTERS.map(adapter => adapter.id);

/** A source as stored in the `job_sources` registry, reduced to what a resolver needs. */
export interface RegistrySource {
  id: string;
  name: string;
  type: SourceType;
  config: SourceConfig;
  requiresUserToken: boolean;
}

type AdapterFactory = (source: RegistrySource) => SourceAdapter | null;

/**
 * Bespoke adapters keep working through `config.adapterId`; they win over the
 * generic factory for their type because they know the upstream payload best.
 */
const bespoke: AdapterFactory = source =>
  (source.config.adapterId && adapterById.get(source.config.adapterId)) || null;

/**
 * Generic factories keyed by registry `type`. Each phase plugs its adapter in
 * here: Phase 2 `rss`/`html`, Phase 3 `apify`, Phase 4 `ai_extract`.
 * Returning `null` means "no adapter can run this source yet".
 */
const FACTORIES: Record<SourceType, AdapterFactory> = {
  api: () => null,
  rss: () => null,
  html: () => null,
  apify: () => null,
  ai_extract: () => null,
};

export function resolveAdapter(source: RegistrySource): SourceAdapter | null {
  const adapter = bespoke(source) ?? FACTORIES[source.type]?.(source) ?? null;
  return adapter;
}

/** Human-readable reason a source cannot run, shown in run.errors and the UI. */
export function unavailableReason(source: RegistrySource): string {
  if (source.requiresUserToken) {
    return 'Connect the provider API key to enable this source';
  }
  if (source.config.adapterId && !adapterById.has(source.config.adapterId)) {
    return `Adapter "${source.config.adapterId}" is not registered`;
  }
  switch (source.type) {
    case 'apify':
      return 'Apify connector is not available yet';
    case 'ai_extract':
      return 'AI extraction adapter is not available yet';
    case 'rss':
    case 'html':
      return 'Generic adapter for this source type is not available yet';
    default:
      return 'No adapter available for this source';
  }
}
