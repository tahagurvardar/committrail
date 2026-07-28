# PostgreSQL backup and restore

CommitTrail's source of truth is PostgreSQL. Take encrypted provider snapshots
or custom-format `pg_dump` backups before migrations and on an operator-defined
schedule. Store backups outside the application host with access controls and a
retention policy appropriate to the data owner.

```bash
DATABASE_URL=... npm run db:backup
DATABASE_URL=... npm run db:backup -- backups/before-v1.backup
```

The script uses `pg_dump --format=custom --no-owner --no-privileges`. Backup
paths and `*.backup`/`*.dump` are gitignored.

Restore only into an isolated, empty recovery database first:

```bash
COMMITTRAIL_ALLOW_RESTORE=yes DATABASE_URL=... \
  npm run db:restore -- backups/before-v1.backup --apply
npm run db:migrate:deploy
npm run db:verify
npm run maintenance -- verify-invariants
```

Then run the integration and E2E suites against that recovery database and
compare aggregate row/invariant counts. A successful command invocation is not
proof of recoverability; schedule periodic restore drills. The v1.0.0 release
verifies the scripts and documents this drill, but does not claim a local
restore drill where PostgreSQL client tools or a disposable local server are
unavailable. CI independently validates migrations and invariants.
