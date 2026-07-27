# CommitTrail — Architecture

_Phase 2 revision. Current architecture first; everything under "Reserved"
is planned but intentionally **not implemented**._

## Current architecture (Phase 1B)

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
    repository/           Live snapshot + activity evidence UI and states
  lib/
    github/               Server-only public-data boundary (see below)
    demo/                 Demo domain: types, deterministic fixtures, derivations
    site.ts               Site config (nav, copy constants)
    trust-principles.ts   Shared product commitments
    format.ts, utils.ts   Deterministic formatting, cn()
```

### The Phase 1 provider boundaries (`src/lib/github/`)

```
types.ts                                Product-owned snapshot model
activity-types.ts                       Product-owned evidence records/sections
errors.ts                               Typed provider error taxonomy
parse-repository-input.ts               Input parsing + validation (SSRF boundary)
public-repository-provider.ts           Narrow provider interface
public-repository-activity-provider.ts  Separate narrow activity interface
github-rest-client.ts                   Shared fixed-origin GET transport
github-rest-public-repository-provider.ts  Snapshot REST implementation
github-rest-public-repository-activity-provider.ts  Bounded activity REST implementation
map-github-response.ts                  Runtime validation + mapping + README safety
map-github-activity-response.ts         Activity validation + privacy mapping
safe-public-text.ts                     Control stripping/whitespace/text bounds
pagination.ts                           Safe next-page disclosure (never follows)
activity-derivations.ts                 Pure sampled arithmetic + timeline
service.ts                              Server-only composition (reads GITHUB_TOKEN)
snapshot-cache.ts                       Success-only ~5-minute data cache boundary
activity-cache.ts                       Full-success-only ~5-minute activity cache
```

- **Server-only.** Provider modules are imported exclusively from Server
  Components; browsers never call GitHub and raw GitHub payload types never
  leave the snapshot/activity mapper boundary.
- **SSRF boundary.** Visitor input is parsed into a validated
  `{ owner, repo }`; requests are constructed only against the fixed
  `https://api.github.com` base with an explicit API version header.
- **External boundary validation.** Responses are runtime-checked before
  mapping; missing required fields produce a typed malformed-response error,
  never invented fallbacks.
- **Bounded requests.** Three GETs per snapshot (metadata, then languages +
  README) plus exactly five page-one activity GETs (commits 20, pulls 20,
  issues 20, releases 10, workflow runs 20): eight maximum for an uncached
  full page. Activity uses two workers, no automatic retries, and a 10 s
  timeout covering body reads. Successful JSON bodies are capped at 2 MiB and
  error-message bodies at 8 KiB. Metadata/default branch is resolved first,
  so its failure prevents the dependent commit request.
- **Pagination is metadata only.** The `Link` parser recognizes an exact
  `next` relation only on `https://api.github.com`. It returns a boolean and
  never follows or exposes the upstream URL.
- **Replaceable.** Routes depend on narrow snapshot and activity provider
  interfaces; tests inject fixture-backed fetch implementations. Persistence
  remains deferred.
- **Partial isolation.** Each activity section carries an
  available/unavailable tagged state. Rate limits, timeouts, upstream outages,
  malformed responses, and unsupported sources remain local; a valid empty
  Actions wrapper is a genuine available empty section. Repository not-found
  stays a full snapshot error and optional-token rejection stays a server
  configuration error.
- **Caching.** Snapshot and activity have separate ~5-minute caches keyed by
  normalized owner/repository (plus public default-branch context for
  activity). Only a resolved snapshot or fully available activity result is
  stored. Partial activity rejects inside the cache callback and is returned
  outside it, so transient unavailable states are not frozen. Keys and values
  contain no secrets.
- **Evidence identity and privacy.** Commits use
  `github:commit:{fullSha}`; PRs, issues, releases, and workflow runs use
  GitHub database IDs. UI models retain no commit email or multiline body,
  issue/release body, raw payload, asset URL, workflow log, or diff. Untrusted
  text is control-stripped, whitespace-normalized, bounded, and React-escaped.

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
  Phase 2 mounts Better Auth lazily at `/api/auth/[...all]` over the Prisma
  adapter. Dashboard layouts, actions, callbacks, exports, and repository
  queries repeat session/workspace authorization server-side; `src/proxy.ts`
  is only an early cookie-presence redirect. Private routes are dynamic and
  never use the public Phase 1 caches.

PostgreSQL stores auth records, one owner workspace, verified installation
metadata, tracked identities, normalized snapshots/evidence, manual sync runs,
and minimal audits. GitHub activation requires app-authenticated installation
lookup plus separate user OAuth verification with new state and PKCE. Tokens
are intentionally absent from the schema.
