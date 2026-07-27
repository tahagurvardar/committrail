# CommitTrail

**Turn GitHub history into evidence-backed engineering stories.**

CommitTrail is an evidence-first engineering timeline and portfolio
intelligence platform. It reads repository facts — and, in later phases,
commits, pull requests, releases, workflow runs, and selected files — and
helps developers turn them into reviewed project milestones and case studies
where **every technical claim links to concrete evidence**.

CommitTrail is deliberately _not_ a statistics dashboard. It never ranks
developers, never infers seniority, and never treats commit counts as
productivity. See [docs/methodology.md](docs/methodology.md) and
[ADR 0003](docs/decisions/0003-no-developer-ranking.md).

> **Status: Phase 1A — public repository snapshot.** Visitors can fetch a
> read-only snapshot (metadata, languages, README) of any public GitHub
> repository — no account, no installation, no write access. Everything
> beyond that scope is previewed with clearly labeled synthetic data. There
> is still **no authentication, no database, no background jobs, no AI
> provider, and no deployment**.

## What exists today

| Route                          | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `/`                            | Public landing page: problem, workflow, evidence graph, trust principles |
| `/explore`                     | Enter a public repository (`owner/repo` or github.com URL) — live data   |
| `/repositories/[owner]/[repo]` | Read-only real snapshot: metadata, languages, README (Phase 1A scope)    |
| `/demo`                        | Deterministic synthetic full-product preview (fictional data, labeled)   |
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
- No GitHub SDK: the three Phase 1A REST endpoints use the native
  server-side `fetch`

## The Phase 1A data boundary

- **Server-only provider.** All GitHub access lives behind
  `PublicRepositoryProvider` (`src/lib/github/`). UI components never call
  GitHub; browsers never talk to the GitHub API.
- **SSRF protection.** Visitor input is parsed and validated into
  `{ owner, repo }` (`parse-repository-input.ts`); requests are constructed
  only against the fixed `https://api.github.com` base. Submitted URLs are
  never fetched.
- **Read-only.** Only GET requests, only public-data endpoints: repository
  metadata, languages, README.
- **Untrusted README handling.** Base64 content is size-capped, decoded, and
  reduced to an escaped plain-text excerpt — no raw repository HTML is ever
  rendered.
- **Honest failures.** Typed states for not-found-or-inaccessible,
  rate-limited (with `Retry-After` or reset timing only when GitHub provides
  it), timeout, upstream unavailability, configuration problems, and
  malformed responses. A GitHub 404 is presented as "not found or not
  publicly accessible" — never a guess about which.
- **Bounded requests.** 10-second timeout, no automatic retries, at most
  three individually bounded requests per snapshot (the final two run in
  parallel).
- **Caching.** Only successfully normalized snapshots enter a ~5-minute
  server data cache. Upstream GETs are otherwise uncached, and invalid input,
  access failures, rate limits, timeouts, and malformed responses are never
  stored as snapshot values. The UI states that data may be delayed by a few
  minutes.

### Optional `GITHUB_TOKEN`

The app works without any environment variables, using GitHub's anonymous
public-data rate limit (shared, 60 requests/hour per address). Operators may
set a server-only `GITHUB_TOKEN` (fine-grained, **no scopes**) to raise the
limit. It is never required, never exposed to the client, never logged, and
never stored — see [.env.example](.env.example).

## Getting started

Requires Node.js 20.9+ (Node 22 recommended — CI runs on 22; see
[.nvmrc](.nvmrc)) and npm.

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. No environment variables are required.

## Scripts

| Script                 | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Start the development server              |
| `npm run build`        | Production build                          |
| `npm run start`        | Serve the production build                |
| `npm run lint`         | ESLint                                    |
| `npm run typecheck`    | TypeScript, no emit                       |
| `npm run format`       | Prettier, write                           |
| `npm run format:check` | Prettier, check only                      |
| `npm test`             | Unit/component tests, single run          |
| `npm run test:watch`   | Tests in watch mode                       |
| `npm run test:e2e`     | Playwright smoke tests (see prerequisite) |

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

A single Next.js application. Implemented now: the server-only public
repository provider boundary. Reserved, not implemented: PostgreSQL +
Prisma, Better Auth, a read-only GitHub App, verified webhook ingestion,
idempotent sync jobs, the evidence graph, publishing, and a grounded
AI-drafting provider boundary. Details:
[docs/architecture.md](docs/architecture.md).

Documentation index:

- [docs/product-spec.md](docs/product-spec.md) — product definition and scope
- [docs/architecture.md](docs/architecture.md) — current and reserved architecture
- [docs/roadmap.md](docs/roadmap.md) — phase plan
- [docs/security-and-privacy.md](docs/security-and-privacy.md) — security posture and commitments
- [docs/methodology.md](docs/methodology.md) — evidence, claims, and approval
- [docs/decisions/](docs/decisions) — architecture decision records

## Current limitations (Phase 1A)

- Snapshot scope is metadata, languages, and README only. Commit, pull
  request, issue, release, and workflow-run ingestion is Phase 1B and is
  never fabricated in the meantime.
- Anonymous GitHub rate limits are shared and small; the UI reports
  `Retry-After` or reset timing only when GitHub supplies it, and otherwise
  says to try later without inventing a time.
- The `/demo` dashboard remains fully synthetic and clearly labeled.
- No accounts, no persistence, no background jobs, no AI drafting, no
  billing, no deployment.
- Playwright is configured but browser tests are opt-in and not in CI.
- `npm audit` reports advisories confined to the ESLint dev toolchain;
  the runtime audit (`npm audit --omit=dev`) is clean.
- No license yet: **licensing will be decided before the public v1 release.**

## Trademark note

CommitTrail is an independent project and is not affiliated with, endorsed
by, or sponsored by GitHub, Inc.
