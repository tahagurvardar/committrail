# CommitTrail — Security and Privacy

_Phase 2 revision. This document states the commitments the implementation
is held to. Where a mechanism is future work, it is marked with the phase
that introduces it._

## Phase 1B posture (today)

- No accounts, no cookies beyond the locally stored theme preference, no
  analytics, no database.
- The only runtime network access is **server-side, read-only GET requests
  to `https://api.github.com`** for public repository data (metadata,
  languages, README, commits, pulls, issues, releases, workflow runs).
  Browsers never call GitHub.
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
- **Allow-listed endpoints:** the shared client accepts repository metadata
  and only the seven explicit suffixes used by Phases 1A/1B. It constructs
  URLs on the fixed base and issues only GET. No visitor URL, Link-header URL,
  archive, asset, workflow log, job, diff, or source file is fetched.
- **Bounded networking:** 10 s per request, no automatic retries, at most
  eight GETs for an uncached full page and at most two concurrent activity
  requests. Successful JSON bodies are capped at 2 MiB before parsing and
  error bodies at 8 KiB. Only page 1 is requested. Link metadata is reduced
  to a safe `hasMore` boolean and never followed or exposed.
- **External response privacy:** runtime mappers retain no commit email,
  multiline commit body, issue/release body, raw response, release asset
  location, workflow log, or authorization material. Public text is
  control-stripped, whitespace-normalized, length-bounded, and escaped.
- **Partial failure isolation:** source-local rate limits, timeout, upstream
  failure, malformed response, and unsupported state remain explicit local
  unavailable states. They are never fabricated as successful empty data.
- **Caching:** only successfully normalized snapshots and fully available
  activity are cached (separately, about five minutes). Partial activity is
  returned but deliberately bypasses caching. Provider GETs, invalid input,
  typed failures, and unavailable sections remain uncached. Tokens never
  enter cache arguments, keys, values, errors, or logs.
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
Phase 2 scopes every dashboard query from the session user through workspace
membership. Setup state is random and stored only as a hash; PKCE verifier
material uses versioned AES-256-GCM with unique nonces and associated data.
The setup installation ID stays pending until GitHub OAuth proves that the
user can access it. JWTs and tokens are short-lived memory values and never
enter PostgreSQL, browser code, logs, exports, or caches. Export and callbacks
send private/no-store responses. Disconnect and deletion make no GitHub write.
