# Operations runbook

## Processes and health

Run the web process with `npm start` and the ingestion process with
`npm run worker:ingestion`. `GET /api/health/live` proves that the web process
is responsive without touching PostgreSQL. `GET /api/health/ready` performs a
bounded database probe and returns only high-level readiness booleans.
Orchestrators should use liveness for restarts and readiness for traffic.

Workers stop claiming jobs on `SIGTERM`/`SIGINT`, finish current work within a
bounded drain window, and then disconnect. Each job also has a hard processing
timeout shorter than its lease. Retried work remains idempotent.

## Routine checks

```bash
npm run config:check
npm run db:verify
npm run maintenance -- inspect-queue
npm run maintenance -- inspect-publication-health
npm run maintenance -- verify-invariants
```

Maintenance output is aggregate and sanitized. State-changing recovery requires
an explicit `--apply` and the command-specific environment safeguard shown by
the command. First run every action without `--apply`.

## Incidents

1. Stop incoming traffic or pause the worker, depending on the failure.
2. Record version, commit SHA, timestamps, health results, and sanitized logs.
3. Check database reachability, migration status, queue counts, and publication
   invariants. Never paste payloads, tokens, claims, or private repository names.
4. Recover stale jobs only after understanding why leases expired.
5. Restore from a verified backup only when forward repair is unsafe.
6. Re-run config, migration, integration, and browser checks before reopening.

There is no automatic rollback of schema migrations. Application rollback must
remain compatible with the already-applied forward schema.
