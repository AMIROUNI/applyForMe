# RULES.md — How the agent must work

You are a careful senior developer working on **Agency-Apply**. Follow `plan.md` step by step. Do not start a step before the previous one is merged and green.

## 1. Core principles

1. **One step = one branch = one PR.** Never mix steps.
2. **Small commits**, each one builds and passes tests.
3. **Test everything you build** before moving on.
4. **No secrets in code, logs, tests, commits, or docs.** Read them from environment variables only.
5. **Ask before** adding a big dependency, changing the stack, or deleting data.
6. If something in `plan.md` is unclear or wrong, write the question or fix in the PR description instead of guessing silently.

## 2. Git workflow

- `main` is protected: always deployable. No direct pushes.
- Branch names: `feat/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`, `test/<name>` (use the names in `plan.md`).
- Start every step:
  ```bash
  git checkout main && git pull
  git checkout -b feat/<name>
  ```
- Commit messages follow **Conventional Commits**: `feat(auth): add login endpoint`, `fix(queue): avoid duplicate jobs`, `test(resume): cover parser errors`.
- Keep the branch fresh: `git fetch && git rebase origin/main` before opening the PR. Resolve conflicts yourself, re-run tests after.
- Open a PR into `main` with the checklist (§4) filled in. Merge with **squash merge** only when CI is green.
- Delete the branch after the merge. Tag releases `vX.Y.Z`.
- New feature mid-project? Create a new branch from `main`, add a short entry to `plan.md` under the right step, then implement it.

## 3. Coding standards

- TypeScript `strict` mode on, no `any` unless justified in a comment.
- Backend: NestJS modules (controller → service → repository), DTO validation on every input, consistent error format `{ statusCode, message, code }`.
- Frontend: Angular standalone components, Signals, reactive forms, lazy-loaded routes, no logic in templates.
- Shared types live in `/packages/shared`.
- Never trust LLM output: validate with a schema (zod) and handle failures.
- Scrapers: rate limited, respect `robots.txt` and site terms, no CAPTCHA/login bypass, fixtures for tests (no live network in CI).
- Logging: structured, no personal data, **never** log API keys, passwords, tokens, or resume contents.
- Security: hash passwords (argon2/bcrypt), encrypt stored provider keys (AES-256-GCM), set CORS/Helmet, rate-limit auth routes, validate file uploads (type, size).

## 4. Definition of done — copy into every PR

```
[ ] Database migration added
[ ] Validation implemented
[ ] Authentication checked
[ ] Authorization checked
[ ] Unit tests added
[ ] Integration tests added
[ ] E2E test for critical flow
[ ] Error handling implemented
[ ] Logging added where appropriate
[ ] Security review completed
[ ] No secrets hardcoded
[ ] Documentation updated
[ ] Build succeeds
[ ] Tests pass
[ ] Linter/formatter passes
```

Mark items that don't apply as `N/A (reason)`. Do not tick a box you didn't verify.

## 5. Testing rules

- Unit: services, utils, ranking, encryption, parsers.
- Integration: API + MongoDB + Redis (use Docker services in CI).
- E2E (Playwright): register → login → upload resume → run search → see cards → open report.
- Mock the LLM and the network in automated tests. Real keys are only for manual local runs.
- A bug fix starts with a failing test.

## 6. Environment and secrets

- Copy `.env.example` → `.env` locally. `.env` is gitignored.
- If the user pastes a real key in chat or in a file, **do not copy it into any committed file**; tell them to put it in `.env` and rotate it.
- Before every commit run a secret scan (gitleaks is part of CI).

## 7. CI/CD pipeline (GitHub Actions)

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  lint-build-test:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports: ['27017:27017']
      redis:
        image: redis:7
        ports: ['6379:6379']
    env:
      MONGODB_URI: mongodb://localhost:27017/agency_apply_test
      REDIS_URL: redis://localhost:6379
      JWT_ACCESS_SECRET: test-access-secret
      JWT_REFRESH_SECRET: test-refresh-secret
      ENCRYPTION_KEY: dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcyEhIQ==
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test -- --ci
      - run: npm audit --audit-level=high

  e2e:
    needs: lint-build-test
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports: ['27017:27017']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

Deploy workflow (added in Step 12), triggered only on tags `v*` or on `main` after CI passes: build Docker images → push to the registry → deploy. Deployment secrets live in GitHub Actions secrets or environments, never in the repo.

Branch protection on `main` (set in GitHub settings): require PR, require the jobs `secrets-scan`, `lint-build-test`, `e2e` to pass, require up-to-date branch, no force-push.

## 8. Working loop for every step

1. Read the step in `plan.md`.
2. Create the branch.
3. Write the failing tests, then the code.
4. Run locally: `npm run lint && npm run build && npm test`.
5. Commit in small pieces, rebase on `main`.
6. Open the PR with the checklist filled in and a short summary of what changed and how you tested it.
7. Wait for green CI, fix anything red, squash-merge.
8. Update `plan.md` (mark the step done, note any decisions), then go to the next step.

## 9. Never do

- Commit `.env`, keys, tokens, or resume files.
- Skip tests or disable lint to get green.
- Push to `main` directly or force-push shared branches.
- Auto-submit an application without the user's confirmation.
- Scrape behind logins, bypass CAPTCHAs, or ignore rate limits.
