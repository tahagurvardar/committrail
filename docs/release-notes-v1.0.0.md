# CommitTrail v1.0.0

CommitTrail 1.0.0 is the first stable evidence-first engineering portfolio
release. It turns bounded GitHub facts into owner-reviewed, provenance-linked
claims without developer ranking or automatic quality/seniority inference.

## Highlights

- Explore public repository facts without an account or use the clearly
  synthetic deterministic demo.
- Connect a read-only GitHub App to a private workspace, ingest minimal verified
  events through a durable PostgreSQL queue, and inspect evidence provenance.
- Author human claims or opt into grounded drafting; suggestions stay private
  and can never auto-verify.
- Deliberately publish immutable PUBLIC or UNLISTED revisions with explicit
  evidence disclosure and private-source redaction.
- Build private deterministic case-study, CV-bullet, and interview-story
  outputs.
- Operate with health checks, configuration and migration verification,
  sanitized logs, maintenance and backup/restore commands, hardened CI,
  deterministic browser/accessibility tests, and an MIT license.

## Upgrade and operations

Use Node 22, npm 10, PostgreSQL 17, run `npm ci`, then
`npm run db:migrate:deploy` and `npm run db:verify`. Review `.env.example`,
`docs/deployment.md`, `docs/operations.md`, and
`docs/backup-and-restore.md`. The optional drafting provider remains disabled
by default.

## Known limitations

GitHub activity is a bounded recent sample, not complete history. There is no
billing, team collaboration, hosted queue, email delivery, scheduler, or
automatic webhook redelivery. Full assistive-technology testing and a real
backup/restore drill remain operator responsibilities. High-severity
development-only audit findings are accepted temporarily under `SECURITY.md`;
the runtime audit is clean.
