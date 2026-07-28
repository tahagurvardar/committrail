# Account data lifecycle

Registration creates a Better Auth user and one personal owner workspace.
Sessions are database-backed; Phase 3 sends no email.

Versioned export contains owned identity/workspace data, non-secret
installation metadata, tracked repositories, normalized snapshots/evidence,
observations, claims/links/revisions, drafting consents, validated candidates,
sentence citations, review history, sync history, delivery and job state, and
minimal audit events. It excludes password hashes,
sessions, cookies, tokens, keys, secrets, signatures, OAuth/PKCE material,
authorization headers, webhook/API bodies, and private content bodies.

Local disconnect deletes the verified installation and related repository
graph without making a GitHub write. A verified installation `deleted`
webhook applies equivalent privacy-preserving cleanup. Repository-access
removal marks affected repositories inaccessible and cancels pending work;
no new evidence is fetched.

Confirmed account deletion removes the user-owned relational graph,
including sessions, deliveries, jobs, observations, claims, and revisions.
It also removes drafting consent history, generation requests, selected
evidence references, candidates, sentence citations, review events, and
AI-assisted claim relationships. There is no public publication state.

GitHub disconnect deletes installation-owned tracked repositories under the
existing private-data policy. Repository-scoped drafts, candidates, claims, and
citations cascade with those repositories; provider consent remains
workspace-level until revoked or the account is deleted.

# Phase 5 lifecycle

Repository disconnect removes its publications and outputs after public routes
are unpublished and cache keys invalidated. Account deletion hides the profile,
removes PUBLIC and UNLISTED routes, deletes profile/publication/output data
transactionally, and retains only non-personal slug reservations against
takeover. No public personal snapshot remains accessible.
