# CommitTrail

**Turn GitHub history into evidence-backed engineering stories.**

CommitTrail is an evidence-first engineering timeline and portfolio
intelligence platform. It will connect to GitHub (read-only), ingest
repository facts — commits, pull requests, issues, releases, workflow runs,
selected files — and help developers turn them into reviewed project
milestones and case studies where **every technical claim links to concrete
evidence**.

CommitTrail is deliberately _not_ a statistics dashboard. It never ranks
developers, never infers seniority, and never treats commit counts as
productivity. See [docs/methodology.md](docs/methodology.md) and
[ADR 0003](docs/decisions/0003-no-developer-ranking.md).

> **Status: Phase 0 — product foundation.** Design system, product surfaces,
> documentation, and quality baseline. Everything on the demo is synthetic and
> deterministic. There is **no GitHub connection, no authentication, no
> database, no AI provider, and no deployment** yet.

## What exists today

| Route          | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `/`            | Public landing page: problem, workflow, evidence graph, trust principles |
| `/demo`        | Deterministic synthetic product demo (fictional developer + repos)       |
| `/about`       | Product purpose, what it is / is not, trust principles                   |
| `/methodology` | Facts → evidence → metrics → drafts → user approval, states, boundaries  |
| `*`            | Custom not-found page                                                    |

The core domain vocabulary (evidence types, confidence states, review states)
is implemented as typed fixtures and reusable components, exercised by the
demo and asserted in tests.

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

## Getting started

Requires Node.js 20.9+ (Node 22 recommended — CI runs on 22) and npm.

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. Phase 0 requires **no environment variables**
([.env.example](.env.example) documents names reserved for later phases).

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

Browser tests are not part of CI in Phase 0. To run them locally once:
`npx playwright install chromium`, then `npm run test:e2e`.

## Testing philosophy

Tests assert product substance, not snapshots: landing content and trust
principles, badge label distinctions, review/confidence state coverage,
deterministic demo-data invariants (evidence counts, coverage math, language
shares summing to 100), navigation, and accessible names for interactive
controls.

## Architecture direction

Phase 0 is a single Next.js application with no backend services, no
database, and no external calls. The architecture reserves — but does not
implement — PostgreSQL + Prisma, Better Auth, a read-only GitHub App with
Octokit REST/GraphQL clients, verified webhook ingestion, idempotent sync
jobs, an evidence graph, public portfolio publishing, and a grounded
AI-drafting provider boundary. Details:
[docs/architecture.md](docs/architecture.md).

Documentation index:

- [docs/product-spec.md](docs/product-spec.md) — product definition and scope
- [docs/architecture.md](docs/architecture.md) — current and reserved architecture
- [docs/roadmap.md](docs/roadmap.md) — phase plan
- [docs/security-and-privacy.md](docs/security-and-privacy.md) — security posture and commitments
- [docs/methodology.md](docs/methodology.md) — evidence, claims, and approval
- [docs/decisions/](docs/decisions) — architecture decision records

## Current limitations (Phase 0)

- All demo data is fictional and hard-coded; no GitHub account can be
  connected.
- No accounts, no persistence, no background jobs, no AI drafting, no
  billing, no deployment.
- Playwright is configured but browser tests are opt-in and not in CI.
- `npm audit` reports advisories in the ESLint toolchain
  (`eslint-config-next` transitive pins); they are dev-time only and resolve
  upstream.
- No license yet: **licensing will be decided before the public v1 release.**

## Trademark note

CommitTrail is an independent project and is not affiliated with, endorsed
by, or sponsored by GitHub, Inc.
