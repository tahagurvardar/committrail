# GitHub App setup

For local development configure:

- Homepage: `http://localhost:3000`
- Setup callback: `http://localhost:3000/api/github/installations/setup`
- User callback: `http://localhost:3000/api/github/oauth/callback`
- Webhook URL: a public HTTPS origin plus `/api/github/webhooks`
- Webhook secret: the same high-entropy `GITHUB_WEBHOOK_SECRET`

Repository permissions are Metadata read, Contents read, Issues read, Pull
requests read, and Actions read. Grant no write or administration permission.
Enable selected-repository installation.

Subscribe to `push`, `pull_request`, `issues`, `release`, `workflow_run`, and
`repository`. GitHub Apps receive `installation` and
`installation_repositories` lifecycle events automatically; the latter
cannot be manually selected. `ping` validates configuration. Do not subscribe
to comments, reviews, jobs, checks, deployments, discussions, stars, forks,
security alerts, or marketplace events.

Setup state is hashed and expiring. PKCE material is encrypted. App lookup
plus user OAuth proves access before local activation; the user token is then
discarded. Every sync/job creates a new short-lived installation token.

For local signed fixtures no public tunnel or real credential is required.
For live verification use a public HTTPS URL, trigger one safe event, inspect
GitHub App **Advanced > Recent deliveries**, then run
`npm run worker:ingestion:once`. See `docs/webhook-recovery.md`.
