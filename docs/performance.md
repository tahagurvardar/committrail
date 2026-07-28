# Performance budgets

The browser suite enforces intentionally generous release guards on
deterministic local fixtures:

- critical pages respond within 5 seconds;
- no horizontal overflow at desktop or 375-pixel mobile viewport;
- first-party JavaScript transferred on the landing page stays below 750 KiB.

These are regression budgets, not production latency claims. CI hardware and
the local Next.js server are not representative of an Internet deployment.

Database access remains bounded by ownership predicates, explicit page-one
limits, unique keys, and migration-defined indexes for queue claims,
publication lookups, profile/project slugs, and immutable revision relations.
`npm run db:verify` checks critical index and trigger names. Operators should
use slow-query logging and `EXPLAIN (ANALYZE, BUFFERS)` against privacy-safe
staging data before changing indexes. Never log query parameters containing
private repository, evidence, claim, or account content.
