# CommitTrail — Architecture

_Phase 4 revision._

CommitTrail is one Next.js 16 App Router application. Public exploration and
private workspace routes share normalized GitHub providers but keep separate
authorization and caching boundaries.

## Runtime boundaries

- `src/lib/github`: fixed-origin, read-only REST transport, response caps,
  normalizers, stable evidence IDs, and the account-free public cache.
- `src/lib/github-app`: lazy GitHub App configuration, short-lived JWTs and
  installation tokens, verified installation activation, and discovery.
- `src/lib/auth`: Better Auth sessions, personal workspaces, owner checks,
  and repository-scoped generic not-found authorization.
- `src/lib/webhooks`: exact-byte HMAC verification, minimal envelope parsing,
  action allow-lists, delivery deduplication, and transactional enqueue.
- `src/lib/ingestion`: PostgreSQL job claiming, leases, retry/dead-letter
  policy, graceful bounded processing, and installation lifecycle work.
- `src/lib/repositories`: manual and targeted reconciliation plus shared
  normalized evidence/observation upserts.
- `src/lib/claims`: owner-scoped transactional claim mutations, optimistic
  versions, revisions, and audit events.
- `src/lib/drafting`: disabled-by-default provider configuration, minimized
  canonical evidence bundles, versioned prompts, strict output/policy
  validation, queued generation, consent, and candidate review.

The webhook route performs no GitHub request. It returns `2xx` only after the
delivery and an ignored or queued result are committed. Workers generate an
ephemeral installation token only after a lease is acquired, perform network
work outside database transactions, and reconcile one source category.

## Data flow

```text
GitHub App delivery
  -> bounded exact bytes
  -> HMAC-SHA256 verification
  -> minimal routing envelope
  -> WebhookDelivery + coalesced IngestionJob (transaction)
  -> SKIP LOCKED worker lease
  -> targeted existing GitHub provider/normalizer
  -> idempotent RepositoryEvidence upsert
  -> append-only EvidenceObservation
  -> private EvidenceClaim <-> ClaimEvidence graph

Explicit selected evidence + private intent
  -> idempotent GROUNDED_DRAFT job
  -> local or consented external provider
  -> strict sentence/citation validation
  -> immutable private candidate
  -> explicit owner acceptance as an unverified claim
```

Manual **Sync now** uses the same evidence persistence and adds
MANUAL_SYNC observations. It remains the recovery path for missed webhook
signals.

## Queue architecture

`IngestionJob` lives in PostgreSQL 17. A partial unique index prevents more
than one PENDING/RUNNING job for a repository/installation and source.
Workers claim up to 10 rows with `FOR UPDATE SKIP LOCKED`, use two-minute
leases and concurrency two, retry transient failures with deterministic
exponential backoff, and move exhausted work to DEAD. GitHub requests never
run inside the claiming transaction.

## Privacy and caching

The database contains normalized product records, hashes, numeric IDs,
bounded statements, states, and sanitized errors. It does not contain raw
webhook/API bodies, signatures, headers, cookies, authorization, tokens,
keys, commit emails, or private content bodies. Authenticated routes are
dynamic and private/no-store; only account-free Phase 1 data uses shared
public caching.

## Decisions

See `docs/decisions/0001` through `0019`, especially raw-body verification,
the PostgreSQL queue, payload non-retention, explicit evidence selection,
sentence citations, external consent, and the human verification boundary.

Phase 4 adds a provider-neutral, server-only drafting boundary. The existing
PostgreSQL worker leases `GROUNDED_DRAFT` jobs, verifies evidence versions and
external consent, calls the configured provider outside a transaction, then
persists only a validated candidate and normalized sentence citations.
Provider configuration is lazy and disabled by default so builds and public
routes need no model settings.

All draft pages use authenticated Server Components/Actions with dynamic,
private, no-store rendering. Public publishing, teams, billing, email delivery,
Redis, paid queues, code execution, GitHub writes, ranking, productivity
inference, and provider tool calls remain out of scope.

## Deferred

Phase 6 may add release hardening, operational readiness, and deployment
preparation. Billing, teams, email, and production deployment remain
unimplemented.

# Phase 5 publication boundary

Mutable profile/publication/output drafts are workspace-scoped. Public reads
first authorize visibility by validated slug, then render only the referenced
immutable revision. Server actions reauthorize the owner, lock mutable rows,
recheck optimistic versions and evidence hashes, write append-only revisions,
and invalidate bounded slug-derived cache keys after commit.
