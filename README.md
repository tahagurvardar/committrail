# CommitTrail

> **Status: Phase 3 — verified webhook ingestion and the human-reviewed evidence graph.**
> The account-free explorer remains available. Users can create a private
> personal workspace, verify a read-only GitHub App installation, track public
> or private repositories, persist bounded normalized evidence, synchronize
> manually, receive verified GitHub App webhooks, process durable targeted
> jobs, inspect provenance, and create private human-authored claims. There is
> no ranking, deployment, public publishing, or AI.

Phase 3 uses PostgreSQL 17, Prisma ORM 7.9.1 with the `pg` driver adapter,
Better Auth 1.6.25 with database sessions, and JOSE 6.2.4 for short-lived
RS256 GitHub App JWTs. See [local database setup](docs/local-database.md),
[GitHub App setup](docs/github-app-setup.md), and the
[account data lifecycle](docs/account-data-lifecycle.md),
[webhook ingestion](docs/webhook-ingestion.md), the
[ingestion worker](docs/ingestion-worker.md), and
[evidence claims](docs/evidence-claims.md).

**Turn GitHub history into evidence-backed engineering stories.**

CommitTrail is an evidence-first engineering timeline and portfolio
intelligence platform. It reads repository facts and bounded recent activity,
then—only in later phases—will help developers turn reviewed evidence into
project milestones and case studies where **every technical claim links to
concrete evidence**.

CommitTrail is deliberately _not_ a statistics dashboard. It never ranks
developers, never infers seniority, and never treats commit counts as
productivity. See [docs/methodology.md](docs/methodology.md) and
[ADR 0003](docs/decisions/0003-no-developer-ranking.md).

## What exists today

| Route                          | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `/`                            | Public landing page: problem, workflow, evidence graph, trust principles |
| `/explore`                     | Enter a public repository (`owner/repo` or github.com URL) — live data   |
| `/repositories/[owner]/[repo]` | Real snapshot plus bounded recent public activity evidence               |
| `/demo`                        | Deterministic synthetic full-product preview (fictional data, labeled)   |
| `/login`, `/register`          | Better Auth email/password identity; no email delivery                   |
| `/dashboard/*`                 | Private delivery/job health, evidence, claims, and graph                 |
| `/about`                       | Product purpose, what it is / is not, trust principles                   |
| `/methodology`                 | Facts → evidence → claims → user approval, states, boundaries            |
| `*`                            | Custom not-found page                                                    |

The live snapshot and the synthetic demo are visually and verbally
distinguished so real facts are never confused with the fictional preview.

## Technology

- [Next.js 16](https://nextjs.org) (App Router, Server Components by default)
- [React 19](https://react.dev)
- Strict [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com) with a token-based design system
  (light/dark, reduced motion, visible focus states)
- shadcn/ui-compatible component structure (`src/components/ui`, cva + `cn`)
- [Vitest](https://vitest.dev) + React Testing Library + jsdom
- [Playwright](https://playwright.dev) configuration prepared for later
  browser tests
- ESLint + Prettier, GitHub Actions CI on Node 22
- PostgreSQL-backed ingestion worker executed with `tsx`; no external queue
- No GitHub SDK: all eight bounded REST requests use native server-side
  `fetch`

## The Phase 1 public-data boundary

- **Server-only provider.** All GitHub access lives behind
  `PublicRepositoryProvider` (`src/lib/github/`). UI components never call
  GitHub; browsers never talk to the GitHub API.
- **SSRF protection.** Visitor input is parsed and validated into
  `{ owner, repo }` (`parse-repository-input.ts`); requests are constructed
  only against the fixed `https://api.github.com` base. Submitted URLs are
  never fetched.
- **Read-only.** Only GET requests to repository metadata, languages, README,
  commits, pulls, issues, releases, and Actions runs. No detail, diff, comment,
  job, log, artifact, asset, or second-page fetches.
- **Untrusted README handling.** Base64 content is size-capped, decoded, and
  reduced to an escaped plain-text excerpt — no raw repository HTML is ever
  rendered.
- **Honest failures.** Typed states for not-found-or-inaccessible,
  rate-limited (with `Retry-After` or reset timing only when GitHub provides
  it), timeout, upstream unavailability, configuration problems, and
  malformed responses. A GitHub 404 is presented as "not found or not
  publicly accessible" — never a guess about which.
- **Bounded requests.** 10-second timeout and no retry. An uncached full page
  costs at most eight requests: metadata first; languages and README; then one
  page each of commits (20), pull requests (20), issues (20), releases (10),
  and workflow runs (20). Activity concurrency never exceeds two. Successful
  JSON bodies are capped at 2 MiB before parsing; error bodies at 8 KiB.
- **Pagination.** Only page 1 is requested. A safely parsed GitHub `Link`
  header can set `hasMore`; its URLs are never followed or exposed.
- **Runtime validation and privacy.** Raw GitHub response shapes stop at the
  provider boundary. Commit email and multiline bodies, issue/release bodies,
  and raw payloads are not retained. Unsafe public text is control-stripped,
  whitespace-normalized, bounded, and rendered as escaped text.
- **Partial availability.** Each activity source is independently available or
  unavailable. A local rate limit, timeout, malformed response, or unsupported
  endpoint does not erase the repository snapshot or other sources. Pull
  requests returned by the issue endpoint are removed.
- **Caching.** Successfully normalized snapshots and fully available activity
  use separate ~5-minute server caches. Partial activity deliberately bypasses
  caching so transient failures are not frozen. Keys contain normalized
  repository identity and no token.

## Activity evidence and deterministic summaries

Every activity item is a product-owned fact record with a stable ID such as
`github:commit:{sha}` or `github:workflow-run:{databaseId}`, a canonical
GitHub link, occurrence time, bounded title, source label, and Fact
confidence. The unified timeline shows at most 30 records from the fetched
windows and never claims complete history.

The only real-data derivations are transparent arithmetic:

- workflow outcomes count completed/successful/failed-like/other and queued or
  in-progress runs; any success percentage uses all completed runs in the
  fetched window as its denominator;
- release interval is the median elapsed days between adjacent published,
  non-draft releases, only with at least three valid releases;
- issue and pull-request summaries count states only inside their recently
  returned samples; a PR is “merged” only when GitHub supplies `merged_at`.

These are not quality, productivity, maturity, reliability, or developer
performance measures. There are no scores or rankings.

### Optional `GITHUB_TOKEN`

The app works without any environment variables, using GitHub's anonymous
public-data rate limit (shared, 60 requests/hour per address). Operators may
set a server-only `GITHUB_TOKEN` (fine-grained, **no scopes**) to raise the
limit. It is never required, never exposed to the client, never logged, and
never stored — see [.env.example](.env.example).

## Getting started

Requires Node.js 22 (CI runs on 22 with npm 10; see
[.nvmrc](.nvmrc)) and npm.

```bash
npm ci
npm run dev
```

The public explorer still needs no account or secret. Private Phase 3 work
requires PostgreSQL and the Phase 2 auth/App variables; webhook intake also
requires `GITHUB_WEBHOOK_SECRET`.

## Scripts

| Script                          | What it does                                      |
| ------------------------------- | ------------------------------------------------- |
| `npm run dev`                   | Start the development server                      |
| `npm run build`                 | Production build                                  |
| `npm run start`                 | Serve the production build                        |
| `npm run lint`                  | ESLint                                            |
| `npm run typecheck`             | TypeScript, no emit                               |
| `npm run format`                | Prettier, write                                   |
| `npm run format:check`          | Prettier, check only                              |
| `npm test`                      | Unit/component tests, single run                  |
| `npm run test:watch`            | Tests in watch mode                               |
| `npm run test:e2e`              | Playwright smoke tests (see prerequisite)         |
| `npm run worker:ingestion`      | Run the durable ingestion worker                  |
| `npm run worker:ingestion:once` | Process one bounded ingestion batch               |
| `npm run db:test:prepare`       | Deploy migrations to the disposable test database |
| `npm run test:integration`      | PostgreSQL integration and queue tests            |

Browser tests are not part of CI. To run them locally once:
`npx playwright install chromium`, then `npm run test:e2e`.

## Testing philosophy

Tests are deterministic and never depend on live GitHub availability: the
input parser is covered against valid, invalid, and malicious-looking forms;
the provider is tested against injected fixture responses (success, 404,
403/429 rate limits, 401, 500, timeout, malformed payloads); UI tests cover
accessible names, validation association, fact labeling, and every honest
failure state. Demo fixtures remain pinned by exact-value tests.

## Architecture direction

A single Next.js application with the public provider boundary, Better Auth,
Prisma/PostgreSQL, a read-only GitHub App, verified minimal-envelope webhook
intake, durable targeted jobs, append-only observations, and a private
human-reviewed claim/evidence graph. Publishing and grounded drafting remain
deferred. Details:
[docs/architecture.md](docs/architecture.md).

Documentation index:

- [docs/product-spec.md](docs/product-spec.md) — product definition and scope
- [docs/architecture.md](docs/architecture.md) — current and reserved architecture
- [docs/roadmap.md](docs/roadmap.md) — phase plan
- [docs/security-and-privacy.md](docs/security-and-privacy.md) — security posture and commitments
- [docs/methodology.md](docs/methodology.md) — evidence, claims, and approval
- [docs/decisions/](docs/decisions) — architecture decision records

## Current limitations (Phase 3)

- Activity is a page-one recent sample, not complete history: 20 commits, 20
  pull requests, 20 issue-endpoint records before PR filtering, 10 releases,
  and 20 workflow runs. There is no load-more or cursor persistence.
- Workflow jobs/logs, commit/PR diffs, reviews, comments, source files, release
  assets, archives, and contributor analysis are not fetched.
- Anonymous GitHub rate limits are shared and small; the UI reports
  `Retry-After` or reset timing only when GitHub supplies it, and otherwise
  says to try later without inventing a time.
- The `/demo` dashboard remains fully synthetic and clearly labeled.
- Webhook workers are explicit local/server processes; there is no scheduler,
  hosted queue, polling, or automatic redelivery.
- Claims are private and human-authored. There is no AI drafting, public
  profile, publishing, billing, team collaboration, or deployment.
- Playwright is configured but browser tests are opt-in and not in CI.
- `npm audit` reports advisories confined to the ESLint dev toolchain;
  the runtime audit (`npm audit --omit=dev`) is clean.
- No license yet: **licensing will be decided before the public v1 release.**

## Trademark note

CommitTrail is an independent project and is not affiliated with, endorsed
by, or sponsored by GitHub, Inc.
