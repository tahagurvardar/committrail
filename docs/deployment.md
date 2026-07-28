# Deployment preparation

No hosted environment is required for v1.0.0. The repository produces a
Next.js standalone server and supports two explicit modes.

## Public demo

Set `APP_MODE=public-demo`. This mode requires no database, authentication,
GitHub App, worker, or paid provider. It exposes the landing page, methodology,
about page, public explorer, and clearly labeled synthetic `/demo`. Proxy rules
make account, workspace, publication, output, and data-export surfaces
unavailable. Never describe it as a multi-user production service.

Required production values:

```text
APP_MODE=public-demo
PUBLIC_APP_URL=https://your-public-origin.example
```

Run `npm run config:check`, `npm run build`, and `npm start`.

## Full application

Set `APP_MODE=full` and provide PostgreSQL, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY`, and the GitHub App/webhook values
documented in `.env.example`. Apply migrations with
`npm run db:migrate:deploy`, run the web and worker processes separately, and
configure health probes. Use HTTPS, managed encrypted backups, secret rotation,
and a dedicated least-privilege database role.

The optional drafting provider is disabled by default. A local provider may use
loopback HTTP; an external provider must use HTTPS and explicit workspace
consent.

## Release and rollback

Deploy the exact immutable release tag. Verify liveness, readiness, migrations,
auth, a public route, a private owner route, webhook signature rejection, and a
worker cycle. Roll back application code only if it remains forward-schema
compatible. Prefer a forward migration/fix for schema faults.

The release task creates no deployment unless a known zero-cost target,
credentials, privacy review, and deterministic smoke path are all available.
