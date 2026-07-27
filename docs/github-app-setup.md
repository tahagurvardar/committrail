# GitHub App setup

Create a private development GitHub App with homepage
`http://localhost:3000`, setup callback
`http://localhost:3000/api/github/installations/setup`, and user callback
`http://localhost:3000/api/github/oauth/callback`.

Grant repository Metadata read (automatic), Contents read, Issues read, Pull
requests read, and Actions read. Enable repository selection. Disable
webhooks; grant no write or administration permission.

Set only the ignored server environment variables in `.env.example`.
`GITHUB_APP_PRIVATE_KEY` is PEM with literal `\n` supported. Never commit
keys, secrets, JWTs, codes, state, PKCE material, or tokens.

Setup state is hashed and expiring. The setup callback uses app
authentication to inspect the installation but keeps it pending. A second
state-bound OAuth flow with PKCE must prove the user token can access that
installation before activation. The user token is discarded immediately.
Sync uses a new optionally repository-narrowed installation token.
