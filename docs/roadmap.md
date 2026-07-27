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
infrastructure. Shared constraints for both halves: **no user account**, no
GitHub App installation, no private repository access, no GitHub write
operation, no published AI-generated claims, no paid infrastructure.
Interfaces may prepare for later persistence, but neither Better Auth nor
the GitHub App installation flow appears here.

### Phase 1A — Input, provider boundary, repository overview ✅ (implemented)

- Accepts a public GitHub repository URL or `owner/repository` identifier,
  parsed and validated into `{ owner, repo }` (SSRF boundary — visitor input
  is never fetched).
- Fetches repository metadata, languages, and README through the
  server-owned `PublicRepositoryProvider` interface (native server `fetch`,
  fixed `api.github.com` base, optional server-only `GITHUB_TOKEN`).
- Renders a read-only snapshot: identity, status, counts, dates, license,
  topics, language distribution, README excerpt — direct facts only.
- Honest typed failure states: not-found-or-inaccessible; rate-limited on
  reliable 403/429 markers with GitHub-provided retry timing when available;
  timeout; upstream unavailability; configuration problems; malformed
  responses.
- Fixture-backed deterministic tests for parser, provider, and UI; no test
  depends on live GitHub.
- Success-only, normalized snapshot caching for about five minutes with a
  visible freshness disclosure; transient and access failures are not cached
  as snapshot values.

### Phase 1B — Public activity ingestion (pending)

- Commit, pull request, issue, release, and workflow-run ingestion for the
  snapshot view — still public-data, read-only, account-free.
- First deterministic derivations over real activity (e.g. release cadence,
  CI pass rates) with recomputability guarantees.
- No milestone generation, no case-study generation, no AI summaries, no
  contributor rankings, no repository scoring.

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
