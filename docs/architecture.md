# CommitTrail — Architecture

_Phase 1A revision. Current architecture first; everything under "Reserved"
is planned but intentionally **not implemented**._

## Current architecture (Phase 1A)

A single Next.js 16 application (App Router, `src/` layout, `@/*` alias).
No backend services, no database, no required environment variables. The
only runtime network access is server-side, read-only, and confined to the
GitHub REST API's public-data endpoints.

```
src/
  app/                    Routes: /, /explore, /repositories/[owner]/[repo],
                          /demo, /about, /methodology, not-found
  components/             Reusable product components
    ui/                   shadcn/ui-compatible primitives (button, badge, card)
    landing/              Landing page sections
    demo/                 Demo dashboard panels (synthetic, presentational)
    explore/              Repository input form (progressive enhancement)
    repository/           Live snapshot UI + typed error states
  lib/
    github/               Server-only public-data boundary (see below)
    demo/                 Demo domain: types, deterministic fixtures, derivations
    site.ts               Site config (nav, copy constants)
    trust-principles.ts   Shared product commitments
    format.ts, utils.ts   Deterministic formatting, cn()
```

### The Phase 1A provider boundary (`src/lib/github/`)

```
types.ts                                Product-owned snapshot model
errors.ts                               Typed provider error taxonomy
parse-repository-input.ts               Input parsing + validation (SSRF boundary)
public-repository-provider.ts           Narrow provider interface
github-rest-public-repository-provider.ts  REST implementation (native fetch)
map-github-response.ts                  Runtime validation + mapping + README safety
service.ts                              Server-only composition (reads GITHUB_TOKEN)
snapshot-cache.ts                       Success-only ~5-minute data cache boundary
```

- **Server-only.** Provider modules are imported exclusively from Server
  Components; browsers never call GitHub and raw GitHub payload types never
  leave `map-github-response.ts`.
- **SSRF boundary.** Visitor input is parsed into a validated
  `{ owner, repo }`; requests are constructed only against the fixed
  `https://api.github.com` base with an explicit API version header.
- **External boundary validation.** Responses are runtime-checked before
  mapping; missing required fields produce a typed malformed-response error,
  never invented fallbacks.
- **Bounded requests.** Three GETs per snapshot (metadata, then languages +
  README in a bounded parallel pair), 10 s timeout covering body reads, no
  automatic retries.
- **Replaceable.** Routes depend on the `PublicRepositoryProvider`
  interface; tests inject fixture-backed fetch implementations, and Phase 2
  can add a persistence-backed provider without touching UI code.
- **Caching.** Uncached provider GETs feed a narrow ~5-minute server data
  cache keyed by normalized owner/repository. Only a resolved, normalized
  snapshot is stored; provider failures remain typed rejections. Route and
  error rendering stay dynamic, so invalid input, not-found, rate-limit,
  configuration, timeout, upstream, malformed, and unexpected failures are
  not retained as normal snapshot values. Cache keys contain no secrets.

Principles in force now:

- **Server Components by default.** Client components only where interaction
  requires them (`ThemeToggle`, `RepositorySelector`, `DemoDashboard`,
  `ExploreForm`).
- **Deterministic demo domain.** `lib/demo` mirrors the future evidence
  model with hand-written fixtures; derivations (`evidenceCoverage`,
  `totalEvidenceLinks`) are pure functions with tests. The demo UI renders
  only from these — no randomness, no clocks — and is clearly labeled
  synthetic, distinct from the live snapshot.
- **Design tokens.** All colors flow through CSS custom properties mapped
  into Tailwind (`globals.css`), with class-based dark mode (next-themes),
  visible focus states, and reduced-motion handling.
- **Quality gates.** Prettier, ESLint (Next core-web-vitals + TS), strict
  TypeScript, Vitest + Testing Library, production build — all in CI on
  Node 22 with no secrets. Tests never depend on live GitHub.

## Reserved architecture (later phases — NOT implemented)

The Phase 0 domain model is shaped so these can be added without rewrites.

### Persistence — PostgreSQL + Prisma

- PostgreSQL as the system of record for facts, evidence, claims, and
  publications; Prisma as the typed data layer.
- Facts are append-only; claims reference evidence by stable IDs (the shape
  `lib/demo/types.ts` already models).

### Authentication — Better Auth

- Account system for authors. Sessions never hold GitHub tokens directly.

### GitHub integration — GitHub App + Octokit

- A GitHub App installation with **read-only** permissions, selected
  repositories only.
- Octokit REST + GraphQL clients behind a thin ingestion interface;
  no direct API calls from UI code.

### Webhook ingestion

- Raw-body signature verification before parsing.
- Delivery-ID deduplication so redeliveries are idempotent.
- Webhooks only enqueue work; they never mutate state inline.

### Sync jobs

- Idempotent, resumable background jobs (cursor-based) that upsert facts.
  Re-running a sync must be a no-op on unchanged data.

### Evidence graph

- Claims ↔ evidence as a first-class graph, powering coverage metrics and
  the public audit trail. `evidenceCoverage` in `lib/demo/derive.ts` is the
  Phase 0 seed of this rule set.

### Publishing

- Public, read-only portfolio pages rendering **published** claims only,
  each with its evidence trail.

### Grounded AI provider boundary

- A single narrow interface for draft generation, provider-agnostic and
  swappable.
- Inputs: collected evidence for one repository/claim. Outputs: draft text
  plus the evidence IDs it cites. Drafts citing unknown evidence IDs are
  rejected mechanically.
- Draft output is always labeled `ai-draft` and enters the review workflow;
  nothing bypasses user approval.

## Non-negotiable constraints across all phases

- Read-only GitHub access; minimum permissions.
- No execution of repository code.
- Deterministic layer stays model-free; AI layer stays evidence-grounded.
- Publication requires explicit user approval.

## Decision records

- [0001 — Single Next.js application](decisions/0001-single-nextjs-application.md)
- [0002 — Evidence-first domain model](decisions/0002-evidence-first-domain-model.md)
- [0003 — No developer ranking](decisions/0003-no-developer-ranking.md)
