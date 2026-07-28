# Phase 3 data model

Better Auth owns `User`, `Session`, `Account`, and `Verification`.
`Workspace` has one owner and an idempotent owner membership.
`GitHubInstallation` stores verified non-secret metadata only.
`TrackedRepository` is identified by GitHub database ID, not owner/name.

`RepositorySnapshot` and `RepositoryEvidence` store normalized bounded
records. Evidence has a deterministic content hash, availability/tombstone
state, stable identity, and first/last-seen timestamps.
`EvidenceObservation` is append-only provenance from MANUAL_SYNC or WEBHOOK;
its deterministic key prevents duplicate delivery/run observations.

`WebhookDelivery` stores the GitHub delivery ID, minimal routing IDs,
payload digest/size, state, counters, and sanitized failure—never the body or
headers. `IngestionJob` stores minimal work, lease/attempt state, and an
active-source deduplication key. `RepositoryIngestionCursor` stores bounded
source success metadata, never arbitrary pagination URLs.

`EvidenceClaim` is a private 1–500 character owner-authored statement with
DRAFT, NEEDS_EVIDENCE, VERIFIED, or ARCHIVED state and optimistic version.
`ClaimEvidence` links facts within one repository; composite foreign keys
enforce that boundary in PostgreSQL. `ClaimRevision` is append-only.
`AuditEvent` stores minimal mutation metadata.

Workspace/user deletion cascades through this private graph. Installation
deletion applies the existing privacy-preserving local disconnect behavior.

Phase 4 adds `WorkspaceDraftingConsent`, `DraftGenerationRequest`,
`DraftGenerationEvidence`, `DraftCandidate`, `DraftSentence`,
`DraftSentenceEvidence`, and append-only `DraftReviewEvent`. Composite foreign
keys ensure selections and citations remain in one request/repository. Partial
unique indexes permit one active owner/repository request and one active
equivalent request hash. Candidate-to-claim is one-to-one.

`EvidenceClaim.origin` is `HUMAN` or `AI_ASSISTED`; a separate flag records a
human edit after acceptance. Candidate sentences remain immutable while review
status and grounding freshness can change. Repository/workspace/user cascades
remove Phase 4 rows without orphans.

# Phase 5 data

`PublicProfile` and `ProjectPublication` hold mutable private configuration.
`ProjectPublicationRevision`, `PublicationClaimSnapshot`, and
`PublicationEvidenceSnapshot` are immutable public snapshots.
`PublicSlugReservation` persists retired names against takeover.
`PublicationEvent` records bounded lifecycle facts. `PortfolioOutput` and
append-only `PortfolioOutputRevision` store private deterministic output
builders.
