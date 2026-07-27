# ADR 0013 — Retain manual reconciliation as webhook recovery

Webhooks are event signals, not a complete delivery guarantee. The existing
bounded **Sync now** path remains available and uses the same normalized
evidence persistence as targeted jobs. It recovers missed signals without
polling, cron, scheduled redelivery, or unlimited history backfill.
