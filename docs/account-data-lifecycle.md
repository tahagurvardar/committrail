# Account data lifecycle

Registration creates a Better Auth user and idempotently ensures one personal
workspace. Sessions are database-backed. Email is a login identifier; Phase 2
sends no verification or password-reset email.

Versioned export includes owned identity, workspace, non-secret installation
metadata, tracked repositories, normalized snapshots/evidence, sync history,
and minimal audit events. It excludes password hashes, sessions, cookies,
provider tokens, keys, secrets, OAuth/PKCE material, authorization headers,
and raw GitHub responses.

Local disconnect transactionally deletes an installation and its tracked
data and invalidates pending attempts; it does not uninstall on GitHub.
Confirmed account deletion removes the user-owned relational graph, including
sessions, without a GitHub write.
