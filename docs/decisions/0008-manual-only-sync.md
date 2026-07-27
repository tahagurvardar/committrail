# ADR 0008 — Manual-only synchronization

Phase 2 has initial and user-triggered manual bounded synchronization only.
A PostgreSQL advisory transaction lock plus RUNNING record rejects concurrent
syncs; stale runs become sanitized failures. Stable IDs make evidence upserts
idempotent. There are no webhooks, schedules, queues, retries, or unseen-record
deletions.
