# MIGRATION — Source Registry (Phase 1)

The list of scrape sources moved from hard-coded constants into a MongoDB collection (`job_sources`) with CRUD endpoints, health tracking, and a country-aware UI. **No breaking changes:** `POST /scraper/runs`, `POST /jobs/search`, and their payloads/responses are unchanged.

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

Validation runs are SSRF-guarded (`url-guard.ts`): only `http(s)`, no private/loopback hosts, no redirects to them.

## Behaviour changes

- **Scraper runs** resolve their source list through the registry (`SourcesService.resolve()`): disabled sources, `requiresUserToken` sources, non-`active` sources, and sources without a matching adapter are skipped with a reason. If the collection is empty, the legacy hard-coded adapter map is used as a fallback.
- **Per-source health** (`health.*`) is updated on run completion instead of only being logged.
- **UI:** new `/sources` page (list, country/status filters, add source, validate + preview modal) linked in the header; the dashboard scraper panel is now country-first — it lists registry sources covering the selected countries, disables non-runnable ones with a status/"connect Apify" suffix, and offers "select all recommended".

## No action required

- No new environment variables.
- No existing documents are modified (collection starts empty or auto-seed).
- Old clients keep working: unknown fields are not required, and run/search contracts are untouched.

## Verification

```bash
npm run build -w packages/shared
npx tsc -p apps/api/tsconfig.build.json --noEmit
npx jest --config apps/api/package.json --rootDir apps/api   # 42 tests
npm run lint -w apps/api
npm run build -w apps/web
npm run lint -w apps/web
```
