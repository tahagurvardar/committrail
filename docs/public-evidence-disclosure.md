# Public evidence disclosure

Evidence disclosure is a separate, explicit decision from claim selection.

- `PUBLIC_SOURCE` is available only for an accessible public repository and a validated HTTPS GitHub URL whose repository and path shape match the evidence type (commit, pull request, issue, release, or workflow run). The public page shows a bounded title, evidence type, optional date, Fact label, and source link.
- `SUMMARY_ONLY` publishes a bounded factual summary with no source URL and explicitly says that no public source link was included.
- `PRIVATE_SOURCE_REDACTED` is required for private repositories. It can show only a generic evidence type, optional owner-approved description, optional coarse date, and the statement that the source belongs to a private repository and is not publicly accessible.

Private disclosure never serializes repository owner/name, repository URL, branch, SHA, source number, original private title, GitHub account, installation metadata, webhook data, or internal evidence ID. Server validation rejects known source identifiers, GitHub URLs, SHA-like values, and numbered source references in the public project fields, selected claims, and approved evidence descriptions. It requires an additional publish acknowledgement and is never described as publicly verifiable.

All evidence labels are facts, not truth scores. Structural grounding establishes traceable membership and versioning, not objective certification.
