# PostgreSQL ingestion worker

The durable queue is PostgreSQL 17; there is no Redis, hosted queue, cron, or
paid infrastructure. Start a long-running local worker with
`npm run worker:ingestion`, or drain one bounded batch with
`npm run worker:ingestion:once`.

Workers claim at most 10 eligible jobs with `FOR UPDATE SKIP LOCKED`, mark
them RUNNING, increment attempts, and acquire a two-minute lease in the short
claim transaction. GitHub network work happens after commit. At most two jobs
are processed concurrently, so one repository failure cannot block another.
An expired lease is reclaimable after a worker crash. SIGINT/SIGTERM stops
polling and lets the current bounded batch settle.

Retryable failures return to PENDING with deterministic exponential backoff:
30 seconds doubled per attempt, capped at 30 minutes. A reliable later
GitHub retry/reset time wins. Permanent validation, access, and suspended
installation failures are not retried. The default maximum is five attempts;
exhausted jobs become DEAD. Stored errors are allow-listed codes only.

A workspace owner can create a new repository-scoped retry from a DEAD job.
The historical job remains DEAD. Queue rows contain minimal routing data and
never contain installation tokens, app keys, webhook bodies, response bodies,
authorization headers, or repository content.
