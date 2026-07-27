# Verified webhook ingestion

CommitTrail receives GitHub App deliveries at `POST /api/github/webhooks`
using the Node.js runtime. Configure a unique, high-entropy
`GITHUB_WEBHOOK_SECRET` of at least 32 bytes. Configuration is lazy: public
pages and builds do not require it, while the endpoint returns a safe `503`
when it is absent.

The handler accepts `application/json`, reads at most 25 MiB as exact bytes,
requires a bounded `X-GitHub-Delivery` and `X-GitHub-Event`, and verifies
`X-Hub-Signature-256` with HMAC-SHA256 and constant-time comparison before
UTF-8 decoding or JSON parsing. Invalid signatures are `401`; malformed
headers are `400`; oversized bodies are `413`; unsupported media are `415`.
Responses are `private, no-store`.

Only `push`, `pull_request`, `issues`, `release`, `workflow_run`,
`repository`, `installation`, and `installation_repositories` are routed.
`ping` is acknowledged. Actions use explicit allow-lists. Default-branch
pushes reconcile commits; other branch pushes are ignored. Issue payloads
with a pull-request marker are ignored.

The transaction stores the delivery ID, event/action, verified local
installation/repository relations, external numeric IDs, payload SHA-256,
byte count, timestamps, state, and sanitized reason/error. It never stores
the body, headers, signature, cookie, authorization, emails, messages, or
private content. A delivery-ID advisory lock and unique constraint make
redelivery idempotent. Related active source jobs coalesce through a partial
unique index. A `2xx` is returned only after delivery and queue state commit.
The request performs no GitHub API call or reconciliation.

GitHub App subscriptions require Metadata read, Contents read, Issues read,
Pull requests read, and Actions read. No write permission is requested.
GitHub Apps receive `installation` and `installation_repositories` lifecycle
events automatically; the latter is not a manually selectable subscription.
