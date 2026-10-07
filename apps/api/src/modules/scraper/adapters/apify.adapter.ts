import { fetchJson } from '../http';
import { parseApiPayload } from './generic-api.adapter';
import type { NormalizedJob, RegistrySource, ScrapeParams, SourceAdapter } from '../scraper.types';

const MAX_ITEMS = 50;
const RUN_TIMEOUT_MS = 90_000;
const APIFY_ORIGIN = 'https://api.apify.com';

/** Documented actor id form: `apify/linkedin-jobs-scraper` -> `apify~...`. */
export const apifyActorPath = (actorId: string): string =>
  encodeURIComponent(actorId.trim().replace(/\//g, '~'));

/**
 * Actor input = per-source `config.inputTemplate` (registry-configurable),
 * then up to 3 keywords injected as the common query fields actors accept.
 * Unknown input fields are ignored by actors that do not use them.
 */
export function buildApifyInput(
  source: RegistrySource,
  params: ScrapeParams
): Record<string, unknown> {
  const template = source.config['inputTemplate'];
  const input: Record<string, unknown> =
    template && typeof template === 'object' && !Array.isArray(template)
      ? { ...(template as Record<string, unknown>) }
      : {};

  const keywords = params.keywords
    .map(keyword => keyword.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (keywords.length) {
    if (input['queries'] === undefined) input['queries'] = keywords.join('\n');
    if (input['query'] === undefined) input['query'] = keywords[0];
    if (input['searchTerm'] === undefined) input['searchTerm'] = keywords[0];
  }
  if (input['maxItems'] === undefined) input['maxItems'] = MAX_ITEMS;
  return input;
}

/**
 * Runs the source's actor synchronously through the user's own Apify token
 * and maps the dataset with the generic JSON mapper. This fetches
 * api.apify.com — an authenticated API endpoint — not the target site, so
 * robots.txt and per-domain politeness for the target are enforced by the
 * actor itself on the user's account; our caps (MAX_ITEMS, RUN_TIMEOUT_MS,
 * the per-source run gap) bound cost and load. The token travels in the
 * Authorization header only, never in the URL.
 */
export function createApifyAdapter(source: RegistrySource, token: string): SourceAdapter {
  return {
    id: source.id,
    name: source.name,
    async scrape(params: ScrapeParams): Promise<NormalizedJob[]> {
      const actorId = String(source.config['apifyActorId'] ?? '').trim();
      if (!actorId) throw new Error('No apifyActorId configured for this source');

      const url = new URL(
        `${APIFY_ORIGIN}/v2/actors/${apifyActorPath(actorId)}/run-sync-get-dataset-items`
      );
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', String(MAX_ITEMS));
      url.searchParams.set('clean', 'true');

      const payload = await fetchJson<unknown>(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApifyInput(source, params)),
        signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
      });

      return parseApiPayload(payload, source, params);
    },
  };
}
