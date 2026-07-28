# Contributing

CommitTrail welcomes focused issues and pull requests that preserve its
evidence-first, privacy-conscious boundaries.

1. Discuss significant product or data-model changes in an issue.
2. Fork the repository and branch from current `main`.
3. Use Node 22, npm 10, PostgreSQL 17, and a separate test database.
4. Run `npm ci`, `npm run db:test:prepare`, and the verification commands in
   `docs/release-checklist.md`.
5. Add deterministic tests for behavior changes. Never use production data,
   credentials, live GitHub responses, or hidden network dependencies.
6. Keep migrations forward-only. Do not use `prisma db push`.
7. Open a pull request using the template and disclose security issues
   privately under `SECURITY.md`.

By participating, you agree to follow `CODE_OF_CONDUCT.md`. Contributions are
licensed under the repository's MIT license.
