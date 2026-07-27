# CommitTrail — Security and Privacy

_Phase 1A revision. This document states the commitments the implementation
is held to. Where a mechanism is future work, it is marked with the phase
that introduces it._

## Phase 1A posture (today)

- No accounts, no cookies beyond the locally stored theme preference, no
  analytics, no database.
- The only runtime network access is **server-side, read-only GET requests
  to `https://api.github.com`** for public repository data (metadata,
  languages, README). Browsers never call GitHub.
- **SSRF boundary:** visitor input is never fetched. It is parsed and
  validated into `{ owner, repo }` (strict GitHub name grammar; non-GitHub
  hosts, credentials, ports, query strings, traversal-like and encoded
  forms are rejected), and requests are constructed only against the fixed
  API base URL.
- **Optional `GITHUB_TOKEN` (server-only).** Never required; the app runs on
  GitHub's anonymous public rate limit without it. When set, it is attached
  as an Authorization header in server code only — never exposed to client
  bundles, HTML, error messages, logs, or test output; never stored; no
  token-management UI. A rejected token surfaces as a _server configuration_
  problem; visitors are never asked for credentials.
- **Untrusted README content:** size-capped base64 decoding, reduced to an
  escaped plain-text excerpt. No raw repository HTML, no
  `dangerouslySetInnerHTML`, no embedded scripts/iframes/remote content.
  External links from API data (homepage, README URL) are validated to
  http(s) and rendered with `rel="noopener noreferrer"`.
- **Bounded networking:** 10 s request timeout, no automatic retries, no
  tight rate-limit retry loops. Error paths never log upstream bodies or
  authorization headers.
- **Caching:** only successfully normalized public snapshot data is cached
  (about five minutes), keyed by normalized owner/repository. Provider GETs
  themselves are uncached; invalid input and every typed failure remain
  uncached. Tokens never enter cache arguments, keys, or values.
- The demo contains only fictional, hand-written data: no real personal
  data, emails, tokens, or production information.
- The build requires no secrets; CI runs without any.

## Commitments

### Read-only GitHub access (Phase 1+, in force)

Phase 1 reads **public repository data only**, through a server-owned
provider, and handles missing repositories, API errors, and rate limits
honestly. Only GET requests are ever issued — never POST, PATCH, PUT, or
DELETE. From Phase 2, the GitHub App requests **read-only** scopes limited
to repositories the user explicitly selects. CommitTrail never requests
write access — this is a product boundary, not a configuration default.

### Minimum-permission principle (all phases)

Every integration, token, and job gets the narrowest scope that works.
Scope expansion requires a documented decision record.

### Webhook raw-body verification (Phase 3+)

Webhook handlers verify the delivery signature against the **raw request
body** before any parsing. Unverified deliveries are rejected and logged
(without payload contents).

### Delivery deduplication (Phase 3+)

Webhook delivery IDs are recorded; redeliveries and replays are idempotent
no-ops.

### Encrypted token storage (Phase 2+)

GitHub App installation tokens and any long-lived credentials are encrypted
at rest, never logged, never sent to the client, and rotated per GitHub's
model.

### No code execution (all phases)

Repository contents are read as text evidence only. CommitTrail never
builds, runs, or evaluates user code — including in CI, including "just to
measure".

### User-controlled publication (all phases)

Nothing becomes public without an explicit approval action by the author.
AI-assisted drafts are visibly labeled and cannot self-publish. Un-publishing
is always available.

### Account export and deletion (Phase 2, with the first persistent user data)

Users can export their data (claims, evidence links, review history) and
delete their account; deletion removes stored facts and, once publishing
exists, published pages.

### Log redaction (Phase 1+)

Logs must never contain secrets, tokens, webhook payload bodies, or private
repository content. Logging uses allow-listed structured fields; identifiers
(delivery IDs, repo IDs) are logged instead of contents.

## Secrets handling rules (already in force)

- No real values in the repository, ever. [.env.example](../.env.example)
  contains only an empty optional `GITHUB_TOKEN` placeholder plus commented,
  inactive names reserved for later phases.
- `.gitignore` excludes `.env*` (except `.env.example`).
- CI requires no secrets and must stay that way until an integration
  genuinely needs one.

## Reporting

Until a proper security policy ships with the public release, security
concerns can be raised as repository issues marked confidential-appropriate
(no exploit details in public issues).
