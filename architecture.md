# ARCHITECTURE.md — Folder structure and code organization

The agent must follow this structure exactly. If a file does not clearly belong somewhere below, ask or propose a change in the PR; do not invent a new top-level folder.

## 1. Repository layout (monorepo)

```
agency-apply/
├── apps/
│   ├── web/                      # Angular frontend
│   └── api/                      # NestJS backend (HTTP API + queue workers)
├── packages/
│   └── shared/                   # Types, schemas and constants used by web and api
├── e2e/                          # Playwright end-to-end tests
├── docs/                         # Extra documentation, ADRs (decision records)
├── .github/
│   ├── workflows/                # ci.yml, deploy.yml
│   └── pull_request_template.md  # Contains the definition-of-done checklist
├── docker-compose.yml            # MongoDB + Redis for local development
├── .env.example                  # Empty values only
├── .gitignore
├── package.json                  # npm workspaces
├── plan.md  rules.md  design.md  architecture.md  security.md
└── README.md
```

## 2. Backend: `apps/api`

```
apps/api/
├── src/
│   ├── main.ts                   # Bootstrap (Helmet, CORS, pipes)
│   ├── app.module.ts
│   ├── config/                   # Env loading + validation (fails at startup if invalid)
│   ├── common/                   # Cross-cutting code
│   │   ├── guards/               # JwtAuthGuard, OwnershipGuard
│   │   ├── filters/              # Global exception filter
│   │   ├── interceptors/         # Logging, serialization
│   │   ├── decorators/           # @CurrentUser()
│   │   └── utils/                # crypto.ts, hash.ts, url.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── dto/
│   │   │   ├── strategies/
│   │   │   └── __tests__/
│   │   ├── users/
│   │   ├── providers/            # User API keys + model ranking
│   │   │   ├── adapters/         # groq.adapter.ts, openai.adapter.ts, ...
│   │   │   └── models.config.ts
│   │   ├── resumes/              # Upload, parsing, profile
│   │   ├── preferences/          # Countries, keywords
│   │   ├── sources/              # Job sites configuration
│   │   ├── jobs/                 # Job documents, cards API
│   │   ├── runs/                 # Search runs + SSE progress
│   │   ├── reports/              # Application reports
│   │   └── agents/
│   │       ├── planner/
│   │       ├── scrapers/
│   │       │   ├── base.scraper.ts
│   │       │   ├── adapters/     # one file per site
│   │       │   └── fixtures/     # saved HTML for tests
│   │       ├── matcher/
│   │       └── apply/
│   └── queue/                    # BullMQ setup, queue names, processors
│       ├── queue.module.ts
│       ├── queue.constants.ts
│       └── processors/
├── test/                         # Integration tests (Supertest)
├── nest-cli.json
└── tsconfig.json
```

### Backend rules
- **Module = one feature.** Each module has `controller`, `service`, `schema` (Mongoose), `dto/`, and `__tests__/`.
- **Layers:** controller (HTTP only) → service (business logic) → repository/model (data). Controllers never touch the database. Services never read `req`/`res`.
- **Dependencies go one way:** `modules` can use `common` and `config`. `common` never imports from `modules`. A module uses another module only through its exported service.
- **Agents** are services; they run inside queue processors, not inside HTTP requests.
- **One scraper adapter per site**, implementing `BaseScraper`. Adding a site = one new file + one fixture + one test.
- **LLM calls only** through `providers` adapters. No direct `fetch` to an LLM anywhere else.
- Config is read once in `config/`; other code gets values by injection, not `process.env`.

## 3. Frontend: `apps/web`

```
apps/web/src/
├── main.ts
├── app/
│   ├── app.config.ts             # Providers, router, interceptors
│   ├── app.routes.ts             # Lazy-loaded routes
│   ├── core/                     # Singletons used app-wide
│   │   ├── auth/                 # auth.service.ts, auth.guard.ts, guest.guard.ts
│   │   ├── http/                 # auth.interceptor.ts, error.interceptor.ts
│   │   └── layout/               # shell, top bar, nav
│   ├── shared/                   # Reusable and dumb
│   │   ├── ui/                   # button, badge, card, empty-state, skeleton
│   │   ├── pipes/
│   │   └── directives/
│   └── features/                 # One folder per screen/feature
│       ├── loading/
│       ├── login/
│       ├── register/
│       ├── dashboard/            # job cards grid + filters
│       ├── resume/
│       ├── preferences/
│       ├── queue/                # run progress panel
│       ├── reports/
│       └── settings/             # provider key + model picker
├── styles/
│   ├── _tokens.scss              # Colors from design.md
│   ├── _typography.scss
│   └── styles.scss
├── assets/
└── environments/
```

### Frontend rules
- Standalone components, Signals for state, lazy routes per feature.
- Each feature folder: `*.page.ts` (route component), `components/`, `data/` (API service + state), `*.spec.ts`.
- `features/*` may import from `core` and `shared`. They must **not** import from each other.
- `shared/ui` components have no API calls and no business logic (inputs/outputs only).
- Styles use tokens from `design.md` through CSS variables.
- Types come from `packages/shared`; do not redefine API types in the frontend.

## 4. Shared package: `packages/shared`

```
packages/shared/src/
├── dto/            # Request/response types
├── schemas/        # zod schemas (job, profile, LLM outputs)
├── enums/          # JobStatus, ApplyMethod, RunStatus
└── index.ts
```

Anything used by both apps goes here. Keep it free of Angular and Nest imports.

## 5. Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Files | `kebab-case` with type suffix | `job-card.component.ts`, `auth.service.ts` |
| Classes | `PascalCase` | `JobsService` |
| Variables/functions | `camelCase` | `scoreJob` |
| Constants/env | `UPPER_SNAKE_CASE` | `SCRAPE_CONCURRENCY` |
| Mongo collections | plural lowercase | `jobs`, `resumes` |
| API routes | plural, kebab-case, versioned | `/api/v1/jobs` |
| Queue names | `kebab-case` | `job-scrape` |
| Branches | `type/short-name` | `feat/job-cards` |
| Tests | next to code or in `__tests__` | `auth.service.spec.ts` |

## 6. API conventions

- Prefix `/api/v1`. JSON only (except file upload: `multipart/form-data`).
- Success: the resource or `{ data, meta }` for lists with pagination (`page`, `limit`, `total`).
- Error: `{ statusCode, code, message, details? }`.
- Every list endpoint is paginated (default 20, max 100).
- Every resource query is filtered by the authenticated `userId`.

## 7. Where things go (quick answers)

| I need to… | Put it in… |
|---|---|
| Add a job site | `agents/scrapers/adapters/<site>.scraper.ts` + fixture + test |
| Add an LLM provider | `providers/adapters/<name>.adapter.ts` + entry in `models.config.ts` |
| Add a new page | `features/<name>/` + lazy route in `app.routes.ts` |
| Add a reusable button/badge | `shared/ui/` |
| Add a shared type | `packages/shared/src/dto/` |
| Add a new queue | `queue/queue.constants.ts` + `queue/processors/` |
| Add an env variable | `.env.example` + `config/` validation + docs |
| Record a big decision | `docs/adr/NNNN-title.md` |

## 8. Limits to keep the code healthy

- File ≤ 300 lines, function ≤ 40 lines. Split when bigger.
- No circular dependencies (CI runs `madge --circular`).
- No dead code or commented-out code in PRs.
- Every new module comes with tests in the same PR.
