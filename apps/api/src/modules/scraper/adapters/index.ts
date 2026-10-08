import type { SourceType } from '@agency-apply/shared';
import type { AdapterContext, RegistrySource, SourceAdapter } from '../scraper.types';
import { remotiveScraper } from './remotive.adapter';
import { remoteOkScraper } from './remoteok.adapter';
import { arbeitnowScraper } from './arbeitnow.adapter';
import { wwrScraper } from './weworkremotely.adapter';
import { createRssAdapter } from './generic-rss.adapter';
import { createHtmlAdapter } from './generic-html.adapter';
import { createApiAdapter } from './generic-api.adapter';

export type { AdapterContext, RegistrySource } from '../scraper.types';

export const SOURCE_ADAPTERS: SourceAdapter[] = [
  remotiveScraper,
  remoteOkScraper,
  arbeitnowScraper,
  wwrScraper,
];

export const adapterById = new Map(SOURCE_ADAPTERS.map(adapter => [adapter.id, adapter]));

/** Known sources we intentionally do not scrape server-side (rules.md). */
export const UNSUPPORTED_SOURCES: Record<string, string> = {
  tanitjobs: 'Protected by anti-bot challenge',
  keepjob: 'Domain retired',
  emploi_nat_tn: 'Legacy session-based site, not supported yet',
  jobicy: 'API no longer publicly accessible',
};

export const DEFAULT_SOURCES = SOURCE_ADAPTERS.map(adapter => adapter.id);

type AdapterFactory = (source: RegistrySource, ctx: AdapterContext) => SourceAdapter | null;

/**
 * Bespoke adapters keep working through `config.adapterId`; they win over the
 * generic factory for their type because they know the upstream payload best.
 */
const bespoke: AdapterFactory = source =>
  (source.config.adapterId && adapterById.get(source.config.adapterId)) || null;

/**
 * Generic factories keyed by registry `type`: `rss`/`html`/`api` since Phase 2.
 * `ai_extract` is intentionally `null` - Phase 4 design: the LLM only proposes
 * candidates, deterministic adapters do the scraping. Returning `null` means
 * "no adapter can run this source yet".
 */
const FACTORIES: Record<SourceType, AdapterFactory> = {
  api: source => (source.config.endpoint ? createApiAdapter(source) : null),
  rss: source => createRssAdapter(source),
  html: source => createHtmlAdapter(source),
  ai_extract: () => null,
};

export function resolveAdapter(
  source: RegistrySource,
  ctx: AdapterContext = {}
): SourceAdapter | null {
  const adapter = bespoke(source, ctx) ?? FACTORIES[source.type]?.(source, ctx) ?? null;
  return adapter;
}

/** Human-readable reason a source cannot run, shown in run.errors and the UI. */
export function unavailableReason(source: RegistrySource, _ctx: AdapterContext = {}): string {
  if (source.requiresUserToken) {
    return 'Connect the provider API key to enable this source';
  }
  if (source.config.adapterId && !adapterById.has(source.config.adapterId)) {
    return `Adapter "${source.config.adapterId}" is not registered`;
  }
  switch (source.type) {
    case 'api':
      return 'No API endpoint configured for this source';
    case 'ai_extract':
      return 'AI extraction is not supported - AI discovery proposes sources, deterministic adapters scrape them';
    default:
      return 'No adapter available for this source';
  }
}
