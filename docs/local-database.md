# Local PostgreSQL

`docker-compose.yml` runs PostgreSQL 17 Alpine at no external cost. Use
separate `committrail` and `committrail_test` databases.

```text
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:validate
npm run db:test:prepare
npm run test:integration
```

CI and production-like systems use the committed migration through
`db:migrate:deploy`; schema push is not a substitute. The test preparation
script requires `TEST_DATABASE_URL`, requires its database/schema identity to
contain `test`, and rejects equality with `DATABASE_URL`. Production builds
generate Prisma Client but do not require a reachable database.
