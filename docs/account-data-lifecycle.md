# Account data lifecycle

Registration creates a Better Auth user and one personal owner workspace.
Sessions are database-backed; Phase 3 sends no email.

Versioned export contains owned identity/workspace data, non-secret
installation metadata, tracked repositories, normalized snapshots/evidence,
observations, human-authored claims/links/revisions, sync history, delivery
and job state, and minimal audit events. It excludes password hashes,
sessions, cookies, tokens, keys, secrets, signatures, OAuth/PKCE material,
authorization headers, webhook/API bodies, and private content bodies.

Local disconnect deletes the verified installation and related repository
graph without making a GitHub write. A verified installation `deleted`
webhook applies equivalent privacy-preserving cleanup. Repository-access
removal marks affected repositories inaccessible and cancels pending work;
no new evidence is fetched.

Confirmed account deletion removes the user-owned relational graph,
including sessions, deliveries, jobs, observations, claims, and revisions.
There is no public publication state to clean up in Phase 3.
