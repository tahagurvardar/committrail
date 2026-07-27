# CommitTrail — Architecture

_Phase 3 revision._

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
  -> private owner-authored EvidenceClaim <-> ClaimEvidence graph
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

See `docs/decisions/0001` through `0013`, especially raw-body verification,
the PostgreSQL queue, payload non-retention, human claims before drafting,
and manual synchronization as webhook recovery.

## Deferred

Phase 4 may add grounded drafting behind the existing evidence and review
boundaries. Public publishing, teams, billing, email delivery, Redis, paid
queues, code execution, GitHub writes, ranking, and productivity inference
are not part of Phase 3.
