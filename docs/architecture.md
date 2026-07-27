# CommitTrail — Architecture

_Phase 0 revision. Current architecture first; everything under "Reserved"
is planned but intentionally **not implemented**._

## Current architecture (Phase 0)

A single Next.js 16 application (App Router, `src/` layout, `@/*` alias).
No backend services, no database, no network calls at runtime, no
environment variables.

```
src/
  app/                    Routes: /, /demo, /about, /methodology, not-found
  components/             Reusable product components
    ui/                   shadcn/ui-compatible primitives (button, badge, card)
    landing/              Landing page sections
    demo/                 Demo dashboard panels (presentational)
  lib/
    demo/                 Demo domain: types, deterministic fixtures, derivations
    site.ts               Site config (nav, copy constants)
    trust-principles.ts   Shared product commitments
    format.ts, utils.ts   Deterministic formatting, cn()
```

Principles in force now:

- **Server Components by default.** Client components only where interaction
  requires them (`ThemeToggle`, `RepositorySelector`, `DemoDashboard` state).
- **Deterministic demo domain.** `lib/demo` mirrors the future evidence
  model with hand-written fixtures; derivations (`evidenceCoverage`,
  `totalEvidenceLinks`) are pure functions with tests. The demo UI renders
  only from these — no randomness, no clocks.
- **Design tokens.** All colors flow through CSS custom properties mapped
  into Tailwind (`globals.css`), with class-based dark mode (next-themes),
  visible focus states, and reduced-motion handling.
- **Quality gates.** Prettier, ESLint (Next core-web-vitals + TS), strict
  TypeScript, Vitest + Testing Library, production build — all in CI on
  Node 22 with no secrets.

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
