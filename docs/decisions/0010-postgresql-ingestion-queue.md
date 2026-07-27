# ADR 0010 — Use PostgreSQL for durable ingestion

Phase 3 uses the existing PostgreSQL 17 system of record as its queue.
`FOR UPDATE SKIP LOCKED`, bounded claims, leases, attempts, deterministic
backoff, and DEAD state provide safe local durability without Redis, BullMQ,
QStash, cron, paid infrastructure, or transactions around GitHub requests.
