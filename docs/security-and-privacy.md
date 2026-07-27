# CommitTrail — Security and privacy

_Phase 3 commitments._

## GitHub access

All access is server-side and read-only. Repository identifiers are
validated and requests use the fixed `https://api.github.com` origin and
allow-listed GET paths. GitHub App permissions are Metadata read, Contents
read, Issues read, Pull requests read, and Actions read. Tokens/JWTs are
short-lived memory values and never enter the database, browser, logs,
exports, cache keys, or jobs.

## Webhook trust boundary

`/api/github/webhooks` accepts JSON at a 25 MiB cap, reads exact bytes,
requires delivery/event/signature headers, and verifies HMAC-SHA256 with
constant-time comparison before decoding or parsing. No user agent or source
IP is treated as primary trust. Missing configuration fails safely and
lazily. Responses are no-store.

Only a minimal envelope is retained. Raw bodies, headers, signatures,
authorization, cookies, commit arrays/messages/emails, issue/release bodies,
GitHub response bodies, and private content are never stored or logged.
Delivery uniqueness plus advisory locks prevents replay duplication.

## Authorization

Better Auth sessions are revalidated in layouts, Server Actions, services,
callbacks, and route handlers; `proxy.ts` is not the sole gate. Every private
repository/claim/evidence/job query derives the personal workspace from the
session and returns generic not-found behavior across owners. Composite
foreign keys and service checks prevent cross-repository claim links.

Authenticated pages are dynamic and private/no-store, excluded from public
metadata and sitemap. Public Phase 1 normalized caches never contain session,
workspace, private repository, or token data.

## Queue and failure safety

Workers claim with `SKIP LOCKED`, short transactions, bounded leases/batches,
maximum attempts, deterministic backoff, and sanitized error codes. Network
requests occur outside transactions. Active job coalescing prevents unlimited
source job creation. DEAD retries create new rows; history is not rewritten.

## Lifecycle

Export excludes credentials and raw payloads. Local disconnect, verified App
uninstall, and account deletion use privacy-preserving relational cleanup.
Repository access removal marks local tracking inaccessible and cancels
pending work. There are no GitHub write calls.

CommitTrail never executes repository code, ranks developers, infers
seniority/productivity, generates claims in Phase 3, or publishes private
data.
