# Local PostgreSQL 17

`docker-compose.yml` provides PostgreSQL 17 Alpine at no external cost. Keep
development and test databases distinct.

```text
docker compose up -d
npm ci
npm run db:generate
npm run db:migrate
npm run db:validate
npm run db:test:prepare
npm run test:integration
npm run worker:ingestion:once
```

`db:test:prepare` accepts only a `TEST_DATABASE_URL` whose database/schema
contains `test` and rejects equality with `DATABASE_URL`. CI deploys committed
migrations to disposable PostgreSQL 17; `prisma db push` is not a migration
substitute. Production builds generate the client lazily and do not need a
reachable database.

The Phase 3 migration is
`20260728203000_phase_3_webhook_ingestion_evidence_graph`. It includes the
active-job partial unique index and composite same-repository claim/evidence
foreign keys.

Phase 4 adds
`20260728221500_phase_4_grounded_drafting_review`. Apply it with
`npm run db:migrate:deploy`. It adds consent history, generation requests,
selected evidence, immutable candidates, normalized sentences/citations,
review events, claim provenance, active-request partial indexes, and composite
same-request/repository citation constraints. Integration tests require a
separate PostgreSQL 17 URL whose database or schema name contains `test`.
