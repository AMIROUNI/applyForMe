# PLAN.md — Agency-Apply

> Read `rules.md` first. Follow it for every step: one branch per step, tests before merge, no secrets in code.

## 1. Goal

A web app that applies to jobs for the user:

1. User signs up / logs in.
2. User connects an LLM provider (API key) and the app picks the best available model.
3. User uploads a resume (CV) and chooses target countries.
4. Parallel agents scrape job sites, store jobs in a NoSQL DB, and show them as **cards**, ranked by fit.
5. The user can apply to each job. If auto-apply is impossible, the app produces an organized **Application Report** explaining how to apply.

## 2. Stack (chosen)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Angular (latest, standalone components, Signals) + Angular Material | Requested; simple UI |
| Backend | Node.js + **NestJS** (TypeScript) | Same language as frontend, modular, good testing |
| Database | **MongoDB** (Mongoose) | NoSQL, flexible job documents |
| Queue | **BullMQ + Redis** | Parallel workers, retries, rate limits, progress events |
| Scraping | **Playwright** (+ Cheerio for static pages) | Handles JS-heavy job sites |
| LLM | Provider abstraction. First provider: **Groq** (OpenAI-compatible API) | Fast, free tier |
| Auth | JWT access token + refresh token (httpOnly cookie), bcrypt/argon2 | Standard |
| Realtime | Server-Sent Events (SSE) for queue progress | Simple |
| CI/CD | GitHub Actions | Requested |

Repo layout (monorepo):

```
/apps/web        Angular app
/apps/api        NestJS app
/packages/shared shared TypeScript types (DTOs, job schema)
/docs            architecture notes
plan.md  rules.md  .env.example  docker-compose.yml
```

## 3. Environment variables

Create `.env` (gitignored) from `.env.example`. **Never commit `.env`.**

```env
# API
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/agency_apply
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
ENCRYPTION_KEY=32-byte-base64-key   # encrypts user-provided API keys at rest

# LLM (default provider used for development)
GROQ_API_KEY=                       # put your real key here, locally only
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

Rules:
- `.env.example` has empty values only.
- In GitHub: Settings → Secrets and variables → Actions → add `GROQ_API_KEY` (only if CI needs it; prefer mocking the LLM in tests).
- Keys that end users enter in the UI are stored **encrypted** (AES-256-GCM using `ENCRYPTION_KEY`), never logged, never returned to the client after saving.

## 4. Architecture

```
Angular  ⇄  NestJS API  ⇄  MongoDB
                │
                ├── BullMQ queues (Redis)
                │     ├─ queue: resume-parse
                │     ├─ queue: job-scrape      (N parallel workers)
                │     ├─ queue: job-match       (LLM scoring)
                │     └─ queue: apply-prepare   (apply or report)
                └── LLM provider adapter (Groq, OpenAI, Anthropic, ...)
```

### Agent flow

1. **Planner agent** — reads the user's resume profile + countries, asks the LLM which job sites/sources to use per country (from a curated `sources` collection, e.g. LinkedIn public pages, Indeed, Welcome to the Jungle, Emploi.nat.tn, Tanitjobs, Remote boards). It creates one scrape job per (source × query).
2. **Scraper agents** — parallel workers. Each one opens a source, extracts jobs, normalizes them, and saves them to MongoDB (dedupe by `hash(url)`).
3. **Matcher agent** — scores each job 0–100 against the resume (skills, seniority, language, location) with a short explanation.
4. **Apply agent** — for each job the user selects: detects apply method (see §9). Either prepares/submits the application or generates the Application Report.

> Respect each site's Terms of Service and `robots.txt`. Use polite rate limits. Do not bypass logins or CAPTCHAs; mark such jobs as "manual apply" and put them in the report.

## 5. Data model (MongoDB)

```ts
User        { _id, email, passwordHash, createdAt }
ProviderKey { _id, userId, provider, encryptedKey, models[], selectedModel, updatedAt }
Resume      { _id, userId, fileName, storagePath, text, profile{ skills[], titles[], years, languages[], education[] }, createdAt }
Preference  { _id, userId, countries[], keywords[], remoteOnly, seniority }
Source      { _id, name, country, baseUrl, type: 'static'|'dynamic', selectors, enabled }
Job         { _id, userId, sourceId, title, company, location, country, description, url, urlHash, postedAt,
              applyMethod: 'easy'|'external'|'email'|'manual', score, scoreReason, status: 'new'|'saved'|'applied'|'skipped', scrapedAt }
Run         { _id, userId, status, progress, startedAt, finishedAt, counts{ scraped, matched, failed } }
Report      { _id, userId, jobId, applyMethod, steps[], requiredDocs[], deadline, contact, notes, createdAt }
```

Indexes: `Job.urlHash` (unique per user), `Job.userId+score`, `User.email` (unique).

## 6. Queue design

- One BullMQ queue per stage (see §4). Worker concurrency set by env (`SCRAPE_CONCURRENCY=3`).
- Each job: 3 retries with exponential backoff; failures go to a dead-letter list shown in the UI.
- Per-domain rate limit (e.g. 1 request / 2 s).
- API exposes `GET /runs/:id/events` (SSE) → Angular shows live progress.
- Idempotent jobs: re-running a scrape must not duplicate data.

## 7. Provider and best-model selection

1. User pastes an API key and chooses a provider (Groq, OpenAI, Anthropic, other OpenAI-compatible).
2. Backend validates the key by calling the provider's list-models endpoint.
3. Backend ranks the available models with a simple rule: prefer a capable instruction-following model with JSON output and a large context window; skip embedding, audio, and guard models. Keep the ranking table in config (`models.config.ts`), not hardcoded in logic.
4. UI shows the recommended model and lets the user override it.
5. The queue workers use the user's selected model. If the call fails (rate limit/model removed) → fall back to the next ranked model.

## 8. Step-by-step build order

Each step = one branch, one PR, all tests green, checklist from `rules.md` completed.

### Step 0 — Bootstrap  `chore/bootstrap`
- Monorepo, Angular + NestJS skeletons, ESLint/Prettier, `docker-compose.yml` (MongoDB + Redis), `.env.example`, `.gitignore` (includes `.env`).
- GitHub Actions CI (see `rules.md`).
- **Done when:** `npm run build`, `npm test`, `npm run lint` pass in CI.

### Step 1 — Authentication system (backend)  `feat/auth-api`
- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /me`.
- Validation (class-validator), password hashing, JWT guard, rate limit on login.
- **Tests:** unit (auth service), integration (register → login → protected route), negative cases (wrong password, duplicate email, expired token).

### Step 2 — Loading page  `feat/web-loading`
- Splash/loading screen shown while the app checks the session (`GET /me`), then redirects to `/login` or `/dashboard`.
- Reusable `LoadingComponent` and an HTTP interceptor that handles token refresh.
- **Tests:** component test (shows spinner, redirects on both outcomes).

### Step 3 — Login & Register pages  `feat/web-auth`
- Reactive forms, inline validation, error messages, route guards (`authGuard`, `guestGuard`).
- **Tests:** component tests for validation; **E2E (Playwright):** register → logout → login → reach dashboard.

### Step 4 — Provider key + model picker  `feat/provider-keys`
- Settings page: add key, validate, list models, show recommended, save choice. Keys encrypted at rest.
- **Tests:** unit for encryption/decryption and model ranking; integration with a mocked provider; verify the key is never returned by any endpoint.

### Step 5 — Resume upload & parsing  `feat/resume`
- Upload PDF/DOCX (size and type limits, virus-safe handling), extract text, queue `resume-parse` → LLM extracts the structured profile → user can review and edit it.
- **Tests:** unit (parser with sample files), integration (upload → profile saved), E2E (upload flow).

### Step 6 — Preferences & country filter  `feat/preferences`
- Country multi-select, keywords, remote toggle, seniority. Saved per user.
- **Tests:** validation, persistence, UI test.

### Step 7 — Queue infrastructure  `feat/queue`
- BullMQ setup, workers, retries, rate limits, SSE progress endpoint, Angular progress component.
- **Tests:** integration with a test Redis; test retry and dedupe behavior.

### Step 8 — Sources & scraper agents  `feat/scrapers`
- `Source` collection + seed for the chosen countries. Planner agent builds the scrape tasks. Playwright/Cheerio scrapers normalize jobs → MongoDB.
- Scraper contract: `scrape(source, query) → NormalizedJob[]`; one adapter per site; adapters tested against saved HTML fixtures (no live network in tests).
- **Tests:** fixture-based unit tests per adapter; integration test for dedupe.

### Step 9 — Job cards UI  `feat/job-cards`
- Dashboard grid of cards: title, company, location, score badge, apply-method badge, status. Filters (country, score, status), sort by score, pagination.
- **Tests:** component tests; E2E (run finishes → cards appear).

### Step 10 — Matching & ranking  `feat/matching`
- Matcher agent scores jobs (0–100 + reason, JSON output validated with a schema). Cards show "best jobs for you" first.
- **Tests:** unit tests with a mocked LLM; schema validation of LLM output; fallback when the model returns invalid JSON.

### Step 11 — Apply flow & Application Report  `feat/apply`
- See §9. Buttons: **Open job site**, **Apply**, **Mark as applied**, **View report**.
- **Tests:** unit for apply-method detection; integration (select jobs → reports generated); E2E on the critical flow.

### Step 12 — Hardening  `chore/hardening`
- Security review, logging, error pages, accessibility pass, docs, Docker image, deploy workflow.
- **Done when:** the full checklist in `rules.md` is green.

## 9. Apply flow and Application Report

Apply-method detection (per job):

| Method | Detection | App behavior |
|---|---|---|
| `easy` | Site has a simple form we can fill without login/CAPTCHA | Prepare tailored cover letter + form data; the user confirms, then submit |
| `external` | Redirects to the company ATS (Greenhouse, Lever, etc.) | Open the link; show prepared answers to copy |
| `email` | Contact email in the posting | Draft the email + attach the resume; the user sends it |
| `manual` | Login wall, CAPTCHA, or unsupported | Generate the **Application Report** |

The user always confirms before anything is sent.

**Application Report** (one per job, clean and scannable) contains:

1. **Summary** — job title, company, location, match score and why.
2. **How to apply** — numbered steps (where to click, which page, which account is needed).
3. **Documents needed** — resume (tailored version attached), cover letter (generated), certificates, portfolio links.
4. **Prepared answers** — ready-to-paste text for common form fields.
5. **Contact / deadline** — email, phone, closing date if known.
6. **Direct link** — and a "Mark as applied" button.

The report page has a header summary, collapsible sections, copy buttons, and an export to PDF. A combined "All reports" view groups by status: *To apply · Applied · Needs manual action*.

## 10. Definition of done (per step)

Use the checklist from `rules.md` in each PR description. A step is not merged until every item is checked or marked N/A with a reason.
