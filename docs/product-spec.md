# CommitTrail — Product specification

_Phase 3 revision: verified webhook ingestion and the human-reviewed evidence graph._

## Definition

CommitTrail turns bounded GitHub facts into private, inspectable engineering
claims where every reviewed statement links to repository evidence.

## Phase 3 user outcome

A signed-in personal workspace owner can connect a verified read-only GitHub
App installation, track a public or private repository, retain normalized
facts, receive signed event signals, inspect durable ingestion health, recover
with manual sync, author a plain-text claim, link same-repository facts, and
explicitly mark the claim verified after review.

Verification means owner review, not external certification. Claims are
private and human-authored.

## Evidence boundary

Supported factual sources remain bounded page-one samples:

- 20 default-branch commits
- 20 pull requests
- 20 issue endpoint records with pull requests removed
- 10 releases
- 20 workflow runs
- repository metadata, languages, and bounded README excerpt

Stable evidence IDs are idempotently upserted. Records outside a newer
bounded sample are preserved. Failed/partial reconciliation does not replace
prior valid facts with emptiness. Release deletion uses an explicit source
tombstone. MANUAL_SYNC and WEBHOOK observations preserve provenance hashes.

## Webhook boundary

The Node endpoint is `/api/github/webhooks`. It verifies
`X-Hub-Signature-256` over exact bytes, requires delivery/event headers,
deduplicates delivery IDs, extracts a minimal envelope, and commits an
ignored or queued result before responding. It subscribes only to `push`,
`pull_request`, `issues`, `release`, `workflow_run`, `repository`,
`installation`, and `installation_repositories`; `ping` is acknowledged.

## Claim rules

- Plain text only, 1–500 characters, no model-generated content.
- Zero evidence is NEEDS_EVIDENCE.
- Verification requires at least one same-workspace/same-repository fact.
- Editing after verification clears `verifiedAt` and returns to DRAFT.
- Removing the final link returns to NEEDS_EVIDENCE.
- Archived claims are immutable until restored.
- Every mutation uses a server session, transaction, optimistic version,
  append-only revision, and minimal audit event.
- There is no publication state.

## Hard boundaries

No AI/RAG/embeddings, public profiles or publishing, case-study/CV/interview
generation, teams, comments, billing, email, cron, Redis/external queues,
paid infrastructure, source cloning/execution, diffs, reviews/comments,
workflow logs/jobs/artifacts, release assets, GitHub writes, developer
ranking, scoring, seniority, productivity, or quality inference.

## Implemented phases

- Phase 0: product foundation, deterministic synthetic preview, design system.
- Phase 1A: account-free public snapshot and SSRF-safe GitHub transport.
- Phase 1B: bounded public activity evidence and deterministic arithmetic.
- Phase 2: Better Auth, PostgreSQL/Prisma, personal workspaces, verified
  read-only GitHub App, private tracking, manual sync, export/deletion.
- Phase 3: verified webhooks, durable PostgreSQL queue/worker, targeted
  reconciliation, observations, private human-authored claims and graph.

Phase 4 is limited to grounded drafting and fuller private review over these
existing evidence links. It must not auto-verify or auto-publish.
