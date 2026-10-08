# MIGRATION — Source Registry (Phase 1) + Generic Adapters (Phase 2) + Browser Extension

The list of scrape sources moved from hard-coded constants into a MongoDB collection (`job_sources`) with CRUD endpoints, health tracking, and a country-aware UI. Phase 2 added generic adapters so most curated sources can actually run. **No breaking changes:** `POST /scraper/runs`, `POST /jobs/search`, and their payloads/responses are unchanged.

The Apify connector (Phase 3 below) was later **removed** and replaced by a paired browser extension that runs LinkedIn/Indeed in the user's own browser — see **Browser extension — hybrid scraping (Apify removed)** before upgrading.

## New collection

`job_sources` — one document per source:

| Field                                 | Notes                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                  | Stable slug (`remotive`, `linkedin`, …) used as the primary key; `_id`/`id` virtuals are disabled so runs reference this slug. |
| `type`                                | `api` \| `rss` \| `html` \| `ai_extract` (the former `apify` value was removed)                                                |
| `status`                              | `active` \| `pending` \| `disabled` \| `broken` — only `active` sources are resolved into runs.                                |
| `countries`                           | ISO-3166 alpha-2 codes, or `*` for globally relevant sources.                                                                  |
| `requiresUserToken`                   | `true` for sources that need the user's own credentials (France Travail, USAJOBS, …).                                          |
| `executionMode` / `requiresExtension` | `server` sources run in the API; `extension` sources (`requiresExtension: true`) are queued for the paired browser extension.  |
| `config`                              | Adapter-specific settings (`adapterId`, `endpoint`, `feedUrls`, `selectors`, `preferJsonLd`, …).                               |
| `health`                              | `lastSuccessAt`, `lastErrorAt`, `failureCount`, `avgLatencyMs` — written automatically after each run.                         |
| `addedBy` / `ownerId`                 | `system` (seeded), `ai`, or `user` (`ownerId` set for user-created sources).                                                   |

### Seeding

- **Automatic:** on API boot, if `job_sources` is empty, the curated seed (29 sources: the 4 working server adapters and the 3 browser-extension sources — `linkedin_jobs`, `linkedin_posts`, `indeed` — as `active`, plus FR/TN/MA/DZ/EG/DE/GB/ES/US/CA/AE/SA entries as `pending`/`disabled`) is inserted.
- **Manual / upsert:** `npm run seed:sources -w apps/api` (uses `MONGODB_URI`, upserts by `id`, never downgrades an existing status).

## API

All routes require a JWT (global `JwtAuthGuard`).

| Route                                 | Purpose                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /sources?country=&type=&status=` | List sources (optional filters).                                                                              |
| `POST /sources`                       | Create a custom source — starts as `pending`.                                                                 |
| `PATCH /sources/:id`                  | Update fields, including `status`.                                                                            |
| `POST /sources/:id/validate`          | Dry run: fetches a preview, records health, and flips `pending` → `active` when ≥ 3 jobs come back.           |
| `POST /sources/discover`              | AI proposes candidates for a country; only deterministically validated ones are added as `pending` (Phase 4). |

Validation runs are SSRF-guarded (`url-guard.ts`): only `http(s)`, no private/loopback hosts, no redirects to them.

## Behaviour changes

- **Scraper runs** resolve their source list through the registry (`SourcesService.resolve()`): disabled sources, `requiresUserToken` sources, non-`active` sources, and sources without a matching adapter are skipped with a reason. If the collection is empty, the legacy hard-coded adapter map is used as a fallback.
- **Per-source health** (`health.*`) is updated on run completion instead of only being logged.
- **UI:** new `/sources` page (list, country/status filters, add source, validate + preview modal) linked in the header; the dashboard scraper panel is now country-first — it lists registry sources covering the selected countries, disables non-runnable ones with a status suffix ("in your browser" for extension sources), and offers "select all recommended".

## Phase 2 — generic adapters

Registry sources no longer need a bespoke adapter to run. `resolveAdapter()` now falls back to a factory per `type` (the bespoke `config.adapterId` adapters still win):

| Type         | Adapter                   | How it finds jobs                                                                                                                                                                                                      |
| ------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `html`       | `generic-html.adapter.ts` | `config.selectors` (user-provided CSS) → schema.org **JobPosting JSON-LD** (`preferJsonLd` sources) → markup heuristics (article/li cards, class-name hints, job-ish link paths).                                      |
| `rss`        | `generic-rss.adapter.ts`  | `config.feedUrls`, or guesses `/feed`, `/rss`, `/jobs/rss`, `/jobs/feed`, `/careers/feed` on the origin and stops at the first feed that yields jobs.                                                                  |
| `api`        | `generic-api.adapter.ts`  | `config.endpoint` (+ optional `config.query` params), finds the list under common keys (`jobs`, `results`, `data`, `hits`, …), maps fields via `config.fieldMap` (`title → position.label` paths) or built-in guesses. |
| `ai_extract` | —                         | unsupported by design (Phase 4); validation reports the reason.                                                                                                                                                        |

Consequences:

- Pending `html`/`rss`/`api` sources are runnable — they become `active` the first time `POST /sources/:id/validate` previews ≥ 3 jobs (existing rule).
- Entries without a title, or without both a link and a company, are dropped so thread-style payloads (e.g. the HN hiring thread) cannot activate a source with junk rows.
- `unavailableReason` changed for `api` sources ("No API endpoint configured for this source"); `rss`/`html` no longer report "generic adapter not available".
- **SSRF:** `config.endpoint`, `config.feedUrls[]` and `config.sitemapUrl` are now validated with the same guard as `baseUrl` on create, patch, and validate — every URL a generic adapter fetches is a public http(s) address.
- `RegistrySource` (internal resolver type) gained `baseUrl` and `remoteFriendly`.

## Phase 3 — Apify connector (**removed**)

> **Superseded.** Commit `7dfa1b0` deleted the whole connector — module `provider-keys` (encrypted token storage, `GET/PUT/DELETE /provider-keys`), `adapters/apify.adapter.ts`, `AdapterContext.apifyToken`, the `apify` source type, and the Sources-page "Apify integration" card. LinkedIn/Indeed now run through the paired browser extension (next section). Kept below for historical reference only.

LinkedIn, Indeed and Glassdoor now run through the user's own Apify account (rules.md: never scraped directly). New module `provider-keys` + adapter:

| Piece                      | Where                           | What                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encrypted key storage      | `provider-keys/crypto.ts`       | AES-256-GCM, `v1:<iv>:<tag>:<ciphertext>`, random 12-byte IV; key material = `ENCRYPTION_KEY` (base64 32-byte used as-is, otherwise SHA-256).                                                                                                                                                                           |
| Collection `provider_keys` | `provider-key.schema.ts`        | `{userId, provider, encryptedKey, lastFour, lastVerifiedAt}` — unique per user+provider.                                                                                                                                                                                                                                |
| Endpoints                  | `provider-keys.controller.ts`   | `GET /provider-keys` (masked state, never the token), `PUT /provider-keys/:provider` (verify with `GET /v2/users/me` **then** store), `DELETE /provider-keys/:provider`. Providers whitelisted (`apify` only for now).                                                                                                  |
| Apify adapter              | `adapters/apify.adapter.ts`     | `POST /v2/actors/{id}/run-sync-get-dataset-items` with `Authorization: Bearer` (never the query string), actor id normalized `a/b → a~b`, 50-item cap (`limit` + `maxItems`), 90s run budget, input = `config.inputTemplate` + ≤3 keywords as `queries`/`query`/`searchTerm`, output mapped by the generic JSON mapper. |
| Context threading          | `AdapterContext { apifyToken }` | `ScraperService.startRun` loads the token per user and passes it through `SourcesService.resolve(ids, ctx)` and `resolveAdapter(source, ctx)`; `validate()` loads it too.                                                                                                                                               |

Consequences:

- `apify` sources are `requiresUserToken` and resolve **only** with a connected token; `unavailableReason` now says "Connect the Apify account to enable this source" (other providers keep the generic message). Non-`apify` `requiresUserToken` sources (e.g. France Travail) stay rejected — their key type is not implemented yet.
- `POST /sources/:id/validate` on an Apify source without a token **refuses** (no reachability probe, no health penalty) with the connect message; with a token it runs the actor, previews jobs, and activates the source like any other.
- The token travels only in headers; URLs and error messages never contain it, and responses expose at most `lastFour` + `lastVerifiedAt`.
- UI: Sources page gained an "Apify integration" card (paste token → verified → masked state → disconnect) and `needsKey` badges flip to "Apify connected"; the scraper sidebar enables connected+active Apify sources and drops the "(Connect Apify to enable)" suffix once connected. Strings added to `translations.en.ts` / `translations.fr.ts`.
- `fetchText` now honors a caller-supplied `signal` (the Apify run's 90s budget) instead of always forcing 15s.

## Phase 4 - AI source discovery

Groq proposes candidate sources for a country; deterministic code validates every candidate and only stores the passing ones as `pending` sources. The LLM never produces final job data.

| Piece            | Where                          | What                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts | `discovery.dto.ts`             | `discoverSourcesSchema` (`country` = 2-letter ISO code, `keywords` <= 5), `discoveryProposalSchema` (all the model may propose: name/baseUrl/type + optional selectors/feedUrls/endpoint), `discoverResultSchema` (per-candidate verdict + 3-job preview).                                                                                                                                |
| LLM adapter      | `sources/llm.service.ts`       | Groq chat completions (`GROQ_BASE_URL`, `GROQ_MODEL`, JSON-object mode, 30s timeout); the key travels only in the `Authorization` header. Every proposal is re-validated with zod - invalid entries are dropped, <= 6 valid ones return. 503 `AI_DISCOVERY_UNCONFIGURED` without `GROQ_API_KEY`, 502 `AI_DISCOVERY_FAILED` / `AI_DISCOVERY_BAD_OUTPUT` on transport or unreadable output. |
| Validator        | `sources/discovery.service.ts` | SSRF guard on `baseUrl` and config URLs -> registry dedupe by origin -> adapter resolves -> robots.txt-aware scrape through the generic adapters -> >= 3 parseable jobs -> stored as `status: pending`, `addedBy: ai`, `ownerId: <caller>`, `countries: [country]`. 500 ms pause between candidates.                                                                                      |
| Endpoint         | `POST /sources/discover`       | `{country, keywords?}` -> `{country, candidates: [{name, baseUrl, type, ok, reason, sourceId, sampleCount, preview[]}]}`.                                                                                                                                                                                                                                                                 |

Consequences:

- `ai_extract` stays unsupported by design - discovery proposes `html`/`rss`/`api` sources that deterministic adapters scrape; `unavailableReason` now spells that out instead of promising a future phase.
- Accepted candidates start `pending` and need `POST /sources/:id/validate` to activate, exactly like hand-added sources (`addedBy: ai` already existed in the schema).
- Failing candidates are reported in the response (safe reason string) and never stored; unsafe URLs never reach the network; registry duplicates are reported with their existing id.
- UI: Sources page gained a "Find sources" button (enabled only while a concrete 2-letter country filter is active) plus a results modal (verdict, reason, preview jobs) and a top alert for AI failures; strings added to `translations.en.ts` / `translations.fr.ts`.
- Env: optional `GROQ_MODEL` (default `llama-3.3-70b-versatile`); discovery needs `GROQ_API_KEY` at call time and fails with a clear 503 when it is missing.

## Browser extension — hybrid scraping (Apify removed)

Apify is gone (commits `7dfa1b0` → `3ab3797`). Server sources (`api`/`rss`/`html`) keep running in the API; `linkedin_jobs`, `linkedin_posts`, and `indeed` are queued as tasks that the user's own browser executes on click through a paired MV3 extension. `POST /scraper/runs` and `POST /jobs/search` payloads are unchanged — runs gain a new `extensionTasks` array (defaults to `[]`).

### Removed

| Piece                       | Was                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `provider-keys` module      | encrypted Apify token storage (collection `provider_keys`), `GET/PUT/DELETE /provider-keys`     |
| `adapters/apify.adapter.ts` | actor calls; `AdapterContext.apifyToken` dropped from `SourcesService.resolve()` / `validate()` |
| `apify` source type         | gone from `sourceTypeSchema` / `SourceType` (`api` \| `rss` \| `html` \| `ai_extract`)          |
| Sources page                | "Apify integration" card and the `needsKey` → "Apify connected" badge flips                     |

`ENCRYPTION_KEY` remains in `.env` and is still validated at boot, but nothing reads it anymore — keep it until encrypted key storage returns.

### New collections

| Collection                     | Document                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `extension_pairing_codes`      | `{codeHash, userId, expiresAt, consumedAt}` — SHA-256 of an 8-character code (ambiguous-free alphabet), 10-minute TTL, single-use         |
| `extension_tokens`             | `{userId, tokenHash, deviceId, label, lastUsedAt, revokedAt, createdAt}` — SHA-256 of a random 32-byte hex token; only the hash is stored |
| `scrape_runs.extensionTasks[]` | `{id, source, status, searchUrl, keywords, countries, remoteOnly, pagesCaptured, itemsFound, message, startedAt, finishedAt}`             |

### API routes

| Route                                                     | Auth            | Purpose                                                                                                               |
| --------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST /extension/pairing`                                 | JWT             | mint a single-use code → `{code, expiresAt}`                                                                          |
| `POST /extension/pair`                                    | `@Public` + zod | exchange code + label → `{token, deviceId}`; `400 PAIRING_CODE_INVALID` when expired or used                          |
| `GET /extension/devices`, `DELETE /extension/devices/:id` | JWT             | list / revoke paired devices (`404` for another user's id)                                                            |
| `GET /extension/tasks`                                    | extension token | the caller's pending/running tasks → `{tasks: [{runId, taskId, source, searchUrl, keywords, countries, remoteOnly}]}` |
| `PATCH /extension/tasks/:taskId`                          | extension token | status / pages / items / message update → returns the run; `409` on an illegal transition                             |
| `POST /ingest/jobs`                                       | extension token | `{runId?, taskId, items ≤ 50}` → `{ingested, found, taskStatus}`                                                      |
| `PATCH /scraper/runs/:id/extension-tasks/:taskId`         | JWT             | user action `cancel` \| `skip` \| `retry` → updated run; `409 TASK_STATE_INVALID`                                     |

- Extension auth: `Authorization: Bearer` or `x-extension-token` header, checked by `ExtensionAuthGuard` against `tokenHash` (never stored or logged raw), `lastUsedAt` stamped per use; every query resolves `userId` from the token — cross-user run/task/device ids return `404`.

### Run semantics

- `SourcesService.resolve()` splits the requested sources into `usable` (server adapters), `extension` (browser tasks), and `rejected` (per-source reason); run `progress.total = server units + extension tasks`, errors unchanged. A run fails only when failed units ≥ total.
- Browser sources carry `executionMode: 'extension'`, `requiresExtension: true`; the search URL is built server-side (`buildExtensionSearchUrl`) and restricted to an allowlist of supported hosts.
- Task state machine (`extension-tasks.ts`): `pending → running → done|blocked|failed|skipped|cancelled`, with `blocked`/`failed`/`skipped` able to return to `running` (retry) and `done`/`cancelled` terminal — illegal transitions answer `409`. A stale sweep (10 min, 60 s timer) parks `pending → skipped` and `running → failed`. Retrying the last task of a finished run reopens it (`status → running`).
- The extension opens one visible, focused tab per task, first-time per-site consent, max 3 pages with 2–5 s random delays, and an immediate Stop; a login wall, CAPTCHA, 403/429, or explicit blocked signal ends the task as `blocked` — never retried, never bypassed, no anti-bot evasion.

### Legacy data migration (automatic, on API boot)

`SourcesService.migrateLegacySources()` (from `onModuleInit`, failures only log a warning):

1. renames `linkedin → linkedin_jobs` and `linkedin-posts → linkedin_posts` (the old row is set to `disabled` if the new id already exists);
2. converts every `type: 'apify'` row to `type: 'html'` with `config: {}` and `requiresUserToken: false`; ids in `EXTENSION_SEED_IDS` (`linkedin_jobs`, `linkedin_posts`, `indeed`) become `executionMode: 'extension'`, `requiresExtension: true`, `status: 'active'`, every other legacy Apify row becomes `status: 'disabled'`.

The seed upsert (`npm run seed:sources -w apps/api`) writes `executionMode`/`requiresExtension` on existing ids and never touches runtime health.

### Web UI (strings in `translations.en.ts` / `translations.fr.ts`)

- Sidebar: extension sources show an "(in your browser)" suffix (`sources.browser`).
- Sources page: "Browser extension" pairing card — generate/copy a code with its expiry, three setup steps, paired-device list with revoke (`sources.extension.*`).
- Dashboard: a "Browser tasks" panel renders above the job list while the active run has `extensionTasks` — status badge, pages/items counts, per-state Cancel/Skip/Retry, browser hint (`extension.tasks.*`); pairing and task actions live in `ExtensionService` / `DashboardState` (client-side `ALLOWED_ACTIONS` mirrors the server state machine; a `409` shows `extension.tasks.actionStale`).

### Extension app (new workspace `apps/extension`)

- MV3, side panel UI, content scripts only on `linkedin.com`/`indeed.com`; `permissions: [tabs, storage, sidePanel]`; `host_permissions` = the two job sites + `http://localhost/*` (the API origin).
- esbuild bundles to `apps/extension/dist` — load unpacked in `chrome://extensions`. The API base defaults to `http://localhost:3000/api/v1` and is editable in the panel; for a hosted API add its origin to `host_permissions` as well (MV3 host permissions, not CORS).
- Pairing state (device token) lives in `chrome.storage.local` and is sent as `Authorization: Bearer`.

### Upgrade steps

1. `npm ci` (a workspace was added), then `npm run build`.
2. No `.env` changes — no new variables; keep `ENCRYPTION_KEY` (still validated at boot).
3. Restart the API: the boot migration converts legacy `apify` rows, and the seed upserts `executionMode`/`requiresExtension` onto existing ids.
4. Rebuild the extension (`npm run build:extension`) and load it unpacked; pair from **Sources → Browser extension**.
5. Existing clients keep working: run/search contracts are untouched and `extensionTasks` defaults to `[]`.

## No action required

- Only optional env: `GROQ_MODEL` has a default; discovery degrades to a clear 503 without `GROQ_API_KEY` (already in `.env.example`). The extension adds **no** new variables.
- Phases 1/2/4 modify no existing documents (collection starts empty or auto-seed; discovery only inserts new `pending` rows). The browser-extension upgrade converts legacy `apify` rows in place — see the migration steps above.
- Old clients keep working: unknown fields are not required, and run/search contracts are untouched (`extensionTasks` defaults to `[]`).

## Verification

```bash
npm run build -w packages/shared
npx tsc -p apps/api/tsconfig.build.json --noEmit
npm run lint                      # web + api + shared + extension
npm run build                     # web + extension + shared + api
npm test                          # web 63, api 110, extension 45 tests
```
