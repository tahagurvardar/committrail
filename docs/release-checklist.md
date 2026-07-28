# v1.0.0 release checklist

Release date: 2026-07-28.

This is the reviewed pre-merge evidence ledger. A Git commit cannot truthfully
embed its own final SHA or pre-claim a tag or GitHub release. Those post-merge
facts are recorded by the annotated `v1.0.0` tag, the GitHub release, and the
release completion report after exact-main CI passes.

Allowed dispositions are `passed`, `not applicable`, `externally unverified`,
and `blocked`.

| Item                             | Disposition           | Evidence or boundary                                                                                  |
| -------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| Exact final `main` SHA           | externally unverified | Recorded only after squash merge and exact-main CI.                                                   |
| Clean working tree               | passed                | Inspected Phase 6 branch matches its remote head.                                                     |
| Package version                  | passed                | `package.json` is `1.0.0`.                                                                            |
| Lockfile version                 | passed                | Root package-lock version is `1.0.0`.                                                                 |
| Migrations                       | passed                | Five ordered migrations deploy on disposable PostgreSQL 17.                                           |
| Configuration documentation      | passed                | Local-full, public-demo, deployment, and environment modes are documented and validated.              |
| Runtime audit                    | passed                | `npm audit --omit=dev` reports zero vulnerabilities.                                                  |
| Full audit                       | passed                | Nine development-only high findings remain visible under the time-bounded `SECURITY.md` exception.    |
| Format                           | passed                | Prettier release gate passes.                                                                         |
| Lint                             | passed                | ESLint release gate passes.                                                                           |
| Typecheck                        | passed                | TypeScript release gate passes.                                                                       |
| Unit/component tests             | passed                | 421 tests in 60 files pass.                                                                           |
| PostgreSQL integration tests     | passed                | 57 tests in five files pass.                                                                          |
| Worker/queue tests               | passed                | Included in the PostgreSQL integration suite.                                                         |
| Browser E2E                      | passed                | 66 of 72 project cases pass; six screenshot/mobile combinations intentionally skip.                   |
| Accessibility automation         | passed                | Axe serious/critical checks pass on critical public and authenticated routes.                         |
| Manual assistive-technology pass | externally unverified | Documented operator responsibility; no unsupported completion claim.                                  |
| Performance budgets              | passed                | Critical fixture routes meet response, overflow, and development JavaScript budgets.                  |
| Production build                 | passed                | Next.js optimized build passes.                                                                       |
| Public serializer privacy        | passed                | PUBLIC, UNLISTED, unpublished, private-source, and prohibited-key tests pass.                         |
| Security headers                 | passed                | Production nonce CSP and defensive response headers are tested and browser-verified.                  |
| Health routes                    | passed                | Sanitized liveness/readiness route tests pass.                                                        |
| Worker shutdown                  | passed                | Bounded job timeout, signal drain, and forced-shutdown behavior are tested.                           |
| Downloads                        | passed                | Authenticated bounded TXT, Markdown, and JSON downloads pass browser tests.                           |
| Account export                   | passed                | Versioned private export boundary remains covered by automated tests.                                 |
| Account deletion                 | passed                | Ownership cleanup and lifecycle tests pass.                                                           |
| Backup/restore drill             | externally unverified | Guarded commands and runbook exist; no local PostgreSQL client/server was available for a real drill. |
| Screenshots                      | passed                | Five deterministic fictional screenshots were visually and privacy reviewed.                          |
| README and operations docs       | passed                | v1 setup, architecture, operations, security, deployment, and limitations are documented.             |
| Licence                          | passed                | MIT, copyright 2026 Taha Gürvardar.                                                                   |
| Changelog                        | passed                | `1.0.0` entry dated 2026-07-28 exists.                                                                |
| Release notes                    | passed                | Reviewed `docs/release-notes-v1.0.0.md` exists.                                                       |
| Release-integrity script         | passed                | Offline release-integrity gate passes.                                                                |
| Annotated `v1.0.0` tag           | externally unverified | Created only after exact-main CI passes.                                                              |
| GitHub release                   | externally unverified | Published only after the annotated tag is pushed.                                                     |
| Optional deployment              | externally unverified | Prepared, but no authenticated zero-cost target or deployed smoke-test URL is available.              |
