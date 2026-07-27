# CommitTrail — Roadmap

Phases are scoped so each one ships a coherent, verifiable slice. Later
phases may split further; boundaries (read-only, no ranking, user approval)
hold in every phase.

## Phase 0 — Product foundation ✅ (complete)

Design system, landing page, synthetic demo, about/methodology pages,
documentation, tests, CI. No GitHub connection, no persistence, no
deployment.

## Phase 1 — Public repository snapshot

A first, honest slice of real GitHub data — without accounts or
infrastructure:

- Accept a public GitHub repository URL or `owner/repository` identifier.
- Fetch public repository information through a **server-owned provider
  interface** (no API calls from client code; provider swappable in tests).
- Display a read-only repository snapshot.
- Fixture-backed deterministic tests for the provider and the snapshot UI.
- Handle missing repositories, inaccessible repositories, API errors, and
  rate-limit responses honestly — real error states, no fabricated data.
- Requires **no user account** and **no GitHub App installation**; requests
  no private repository access; performs no GitHub write operation;
  publishes no AI-generated claims; avoids paid infrastructure.
- May prepare interfaces for later persistence, but introduces neither
  Better Auth nor the GitHub App installation flow.

## Phase 2 — Identity, persistence, and GitHub App connection

- Better Auth accounts and user-owned workspaces.
- PostgreSQL + Prisma as the system of record.
- GitHub App installation with selected-repository, read-only permissions.
- Installation-token handling (encrypted at rest, never logged).
- Account export and deletion, shipped with the first persistent user data.
- Persistent tracked repositories and sync state.

## Phase 3 — Continuous ingestion and the evidence graph

- Webhook ingestion with raw-body signature verification and delivery-ID
  deduplication.
- Idempotent, resumable sync jobs (re-running a sync is a no-op on
  unchanged data).
- Evidence linking UI: pin facts, files, and doc sections to claims.
- Deterministic derivations over real facts (language evolution, CI pass
  rates, release cadence) with recomputability guarantees; coverage rules
  promoted from the Phase 0 demo implementation.

## Phase 4 — Drafting and review workflow

- Grounded AI provider boundary: drafts generated only from collected
  evidence, mechanically rejected if they cite unknown evidence IDs.
- Full review workflow: draft → needs-evidence → verified, with edit and
  reject paths. Everything stays private.

## Phase 5 — Publishing

- Public project pages and timelines rendering **published** claims only,
  each claim with its evidence trail.
- Case study, CV bullet, and interview-story exports.

## Phase 6 — Hardening and sustainability

- Private repository support (still read-only), rate-limit resilience,
  operational observability (with redacting logs).
- Licensing decision executed before public v1. Billing evaluated here at
  the earliest.

## Explicit non-goals (any phase)

Developer ranking or scoring, seniority inference, productivity metrics from
commit counts, burnout estimation, code execution, GitHub write access,
auto-published AI output.
