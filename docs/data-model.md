# Phase 2 data model

Better Auth owns `User`, `Session`, `Account`, and `Verification`.
`Workspace` has a unique owner plus an idempotent owner membership.
`GitHubConnectionAttempt` stores hashed state, encrypted short-lived PKCE
material, expiry, consumption, and an optional pending installation ID.

`GitHubInstallation` stores verified non-secret metadata but no tokens.
`TrackedRepository` uses GitHub’s database ID rather than owner/name.
`RepositorySnapshot` and `RepositoryEvidence` contain normalized product
models only. Evidence identity is unique by tracked repository and stable
evidence ID. Sync runs contain sanitized state/counts; audit events are
minimal. Cascades remain inside the owning account/workspace graph.
