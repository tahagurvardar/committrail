# Webhook recovery

GitHub does not automatically redeliver every failed delivery. In the GitHub
App settings, inspect **Advanced > Recent deliveries**, open the delivery,
confirm the target URL and response, then use GitHub's redelivery control.
The same `X-GitHub-Delivery` is safely deduplicated by CommitTrail.

For missed or unavailable deliveries:

1. Restore `GITHUB_WEBHOOK_SECRET`, PostgreSQL, and the local worker.
2. Run `npm run worker:ingestion:once` and inspect the private repository
   health table.
3. Create a safe retry for a DEAD job if its cause is resolved.
4. Use the repository's **Sync now** action to perform the existing bounded
   full reconciliation.

Manual synchronization and webhook jobs share normalized upsert and
observation persistence. Neither path claims complete history; evidence
outside the recent source window is preserved.
