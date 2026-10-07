# MIGRATION — Source Registry (Phase 1) + Generic Adapters (Phase 2)

The list of scrape sources moved from hard-coded constants into a MongoDB collection (`job_sources`) with CRUD endpoints, health tracking, and a country-aware UI. Phase 2 added generic adapters so most curated sources can actually run. **No breaking changes:** `POST /scraper/runs`, `POST /jobs/search`, and their payloads/responses are unchanged.

## New collection

`job_sources` — one document per source:

| Field | Notes |
|---|---|
| `id` | Stable slug (`remotive`, `linkedin`, …) used as the primary key; `_id`/`id` virtuals are disabled so runs reference this slug. |
| `type` | `api` \| `rss` \| `html` \| `apify` \| `ai_extract` |
| `status` | `active` \| `pending` \| `disabled` \| `broken` — only `active` sources are resolved into runs. |
| `countries` | ISO-3166 alpha-2 codes, or `*` for globally relevant sources. |
| `requiresUserToken` | `true` for sources that need the user's own credentials (Apify account, LinkedIn, …). |
| `config` | Adapter-specific settings (`adapterId`, `endpoint`, `feedUrls`, `selectors`, `apifyActorId`, …). |
| `health` | `lastSuccessAt`, `lastErrorAt`, `failureCount`, `avgLatencyMs` — written automatically after each run. |
| `addedBy` / `ownerId` | `system` (seeded), `ai`, or `user` (`ownerId` set for user-created sources). |

### Seeding

- **Automatic:** on API boot, if `job_sources` is empty, the curated seed (30 sources: the 4 working adapters as `active`, plus FR/TN/MA/DZ/EG/DE/GB/ES/US/CA/AE/SA and Apify-only entries as `pending`/`disabled`) is inserted.
- **Manual / upsert:** `npm run seed:sources -w apps/api` (uses `MONGODB_URI`, upserts by `id`, never downgrades an existing status).

## API

All routes require a JWT (global `JwtAuthGuard`).

| Route | Purpose |
|---|---|
| `GET /sources?country=&type=&status=` | List sources (optional filters). |
| `POST /sources` | Create a custom source — starts as `pending`. |
| `PATCH /sources/:id` | Update fields, including `status`. |
| `POST /sources/:id/validate` | Dry run: fetches a preview, records health, and flips `pending` → `active` when ≥ 3 jobs come back. |
| `POST /sources/discover` | AI proposes candidates for a country; only deterministically validated ones are added as `pending` (Phase 4). |

Validation runs are SSRF-guarded (`url-guard.ts`): only `http(s)`, no private/loopback hosts, no redirects to them.

## Behaviour changes

- **Scraper runs** resolve their source list through the registry (`SourcesService.resolve()`): disabled sources, `requiresUserToken` sources, non-`active` sources, and sources without a matching adapter are skipped with a reason. If the collection is empty, the legacy hard-coded adapter map is used as a fallback.
- **Per-source health** (`health.*`) is updated on run completion instead of only being logged.
- **UI:** new `/sources` page (list, country/status filters, add source, validate + preview modal) linked in the header; the dashboard scraper panel is now country-first — it lists registry sources covering the selected countries, disables non-runnable ones with a status/"connect Apify" suffix, and offers "select all recommended".

## Phase 2 — generic adapters

Registry sources no longer need a bespoke adapter to run. `resolveAdapter()` now falls back to a factory per `type` (the bespoke `config.adapterId` adapters still win):

| Type | Adapter | How it finds jobs |
|---|---|---|
| `html` | `generic-html.adapter.ts` | `config.selectors` (user-provided CSS) → schema.org **JobPosting JSON-LD** (`preferJsonLd` sources) → markup heuristics (article/li cards, class-name hints, job-ish link paths). |
| `rss` | `generic-rss.adapter.ts` | `config.feedUrls`, or guesses `/feed`, `/rss`, `/jobs/rss`, `/jobs/feed`, `/careers/feed` on the origin and stops at the first feed that yields jobs. |
| `api` | `generic-api.adapter.ts` | `config.endpoint` (+ optional `config.query` params), finds the list under common keys (`jobs`, `results`, `data`, `hits`, …), maps fields via `config.fieldMap` (`title → position.label` paths) or built-in guesses. |
| `apify`, `ai_extract` | — | still unavailable (Phases 3 and 4); validation reports the reason. |

Consequences:

- Pending `html`/`rss`/`api` sources are runnable — they become `active` the first time `POST /sources/:id/validate` previews ≥ 3 jobs (existing rule).
- Entries without a title, or without both a link and a company, are dropped so thread-style payloads (e.g. the HN hiring thread) cannot activate a source with junk rows.
- `unavailableReason` changed for `api` sources ("No API endpoint configured for this source"); `rss`/`html` no longer report "generic adapter not available".
- **SSRF:** `config.endpoint`, `config.feedUrls[]` and `config.sitemapUrl` are now validated with the same guard as `baseUrl` on create, patch, and validate — every URL a generic adapter fetches is a public http(s) address.
- `RegistrySource` (internal resolver type) gained `baseUrl` and `remoteFriendly`.

## Phase 3 — Apify connector

LinkedIn, Indeed and Glassdoor now run through the user's own Apify account (rules.md: never scraped directly). New module `provider-keys` + adapter:

| Piece | Where | What |
|---|---|---|
| Encrypted key storage | `provider-keys/crypto.ts` | AES-256-GCM, `v1:<iv>:<tag>:<ciphertext>`, random 12-byte IV; key material = `ENCRYPTION_KEY` (base64 32-byte used as-is, otherwise SHA-256). |
| Collection `provider_keys` | `provider-key.schema.ts` | `{userId, provider, encryptedKey, lastFour, lastVerifiedAt}` — unique per user+provider. |
| Endpoints | `provider-keys.controller.ts` | `GET /provider-keys` (masked state, never the token), `PUT /provider-keys/:provider` (verify with `GET /v2/users/me` **then** store), `DELETE /provider-keys/:provider`. Providers whitelisted (`apify` only for now). |
| Apify adapter | `adapters/apify.adapter.ts` | `POST /v2/actors/{id}/run-sync-get-dataset-items` with `Authorization: Bearer` (never the query string), actor id normalized `a/b → a~b`, 50-item cap (`limit` + `maxItems`), 90s run budget, input = `config.inputTemplate` + ≤3 keywords as `queries`/`query`/`searchTerm`, output mapped by the generic JSON mapper. |
| Context threading | `AdapterContext { apifyToken }` | `ScraperService.startRun` loads the token per user and passes it through `SourcesService.resolve(ids, ctx)` and `resolveAdapter(source, ctx)`; `validate()` loads it too. |

Consequences:

- `apify` sources are `requiresUserToken` and resolve **only** with a connected token; `unavailableReason` now says "Connect the Apify account to enable this source" (other providers keep the generic message). Non-`apify` `requiresUserToken` sources (e.g. France Travail) stay rejected — their key type is not implemented yet.
- `POST /sources/:id/validate` on an Apify source without a token **refuses** (no reachability probe, no health penalty) with the connect message; with a token it runs the actor, previews jobs, and activates the source like any other.
- The token travels only in headers; URLs and error messages never contain it, and responses expose at most `lastFour` + `lastVerifiedAt`.
- UI: Sources page gained an "Apify integration" card (paste token → verified → masked state → disconnect) and `needsKey` badges flip to "Apify connected"; the scraper sidebar enables connected+active Apify sources and drops the "(Connect Apify to enable)" suffix once connected. Strings added to `translations.en.ts` / `translations.fr.ts`.
- `fetchText` now honors a caller-supplied `signal` (the Apify run's 90s budget) instead of always forcing 15s.

## Phase 4 - AI source discovery

Groq proposes candidate sources for a country; deterministic code validates every candidate and only stores the passing ones as `pending` sources. The LLM never produces final job data.

| Piece | Where | What |
|---|---|---|
| Shared contracts | `discovery.dto.ts` | `discoverSourcesSchema` (`country` = 2-letter ISO code, `keywords` <= 5), `discoveryProposalSchema` (all the model may propose: name/baseUrl/type + optional selectors/feedUrls/endpoint), `discoverResultSchema` (per-candidate verdict + 3-job preview). |
| LLM adapter | `sources/llm.service.ts` | Groq chat completions (`GROQ_BASE_URL`, `GROQ_MODEL`, JSON-object mode, 30s timeout); the key travels only in the `Authorization` header. Every proposal is re-validated with zod - invalid entries are dropped, <= 6 valid ones return. 503 `AI_DISCOVERY_UNCONFIGURED` without `GROQ_API_KEY`, 502 `AI_DISCOVERY_FAILED` / `AI_DISCOVERY_BAD_OUTPUT` on transport or unreadable output. |
| Validator | `sources/discovery.service.ts` | SSRF guard on `baseUrl` and config URLs -> registry dedupe by origin -> adapter resolves -> robots.txt-aware scrape through the generic adapters -> >= 3 parseable jobs -> stored as `status: pending`, `addedBy: ai`, `ownerId: <caller>`, `countries: [country]`. 500 ms pause between candidates. |
| Endpoint | `POST /sources/discover` | `{country, keywords?}` -> `{country, candidates: [{name, baseUrl, type, ok, reason, sourceId, sampleCount, preview[]}]}`. |

Consequences:

- `ai_extract` stays unsupported by design - discovery proposes `html`/`rss`/`api` sources that deterministic adapters scrape; `unavailableReason` now spells that out instead of promising a future phase.
- Accepted candidates start `pending` and need `POST /sources/:id/validate` to activate, exactly like hand-added sources (`addedBy: ai` already existed in the schema).
- Failing candidates are reported in the response (safe reason string) and never stored; unsafe URLs never reach the network; registry duplicates are reported with their existing id.
- UI: Sources page gained a "Find sources" button (enabled only while a concrete 2-letter country filter is active) plus a results modal (verdict, reason, preview jobs) and a top alert for AI failures; strings added to `translations.en.ts` / `translations.fr.ts`.
- Env: optional `GROQ_MODEL` (default `llama-3.3-70b-versatile`); discovery needs `GROQ_API_KEY` at call time and fails with a clear 503 when it is missing.

## No action required

- Only optional env: `GROQ_MODEL` has a default; discovery degrades to a clear 503 without `GROQ_API_KEY` (already in `.env.example`).
- No existing documents are modified (collection starts empty or auto-seed; discovery only inserts new `pending` rows).
- Old clients keep working: unknown fields are not required, and run/search contracts are untouched.

## Verification

```bash
npm run build -w packages/shared
npx tsc -p apps/api/tsconfig.build.json --noEmit
npx jest --config apps/api/package.json --rootDir apps/api   # 92 tests
npm run lint -w apps/api
npm run build -w apps/web
npm run lint -w apps/web
```
