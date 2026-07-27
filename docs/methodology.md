# CommitTrail — Methodology

## Facts and bounded samples

A Fact is a normalized read-only GitHub record with stable identity,
canonical source, occurrence time, bounded safe title, and factual payload.
The sample limits are explicit; CommitTrail never claims complete history.
Commit emails, multiline bodies, comments, diffs, workflow logs/jobs, and
release assets are not retained.

## Observations and provenance

The same Fact may be observed by a manual sync or verified webhook job.
`EvidenceObservation` records that source, related run/delivery, observation
time, and normalized content hash. It is append-only and idempotent. A newer
bounded sample does not erase older evidence. Deletion or lost access is an
explicit source state, not fabricated absence.

## Claims and authorship provenance

Phase 3 introduced plain-text owner statements. Phase 4 also permits an owner
to accept a mechanically grounded candidate as an `AI_ASSISTED` claim. The
owner selects same-repository evidence and reviews the relationship in both
flows; a later human edit is recorded without erasing the assisted origin.

```text
NEEDS_EVIDENCE -> DRAFT -> VERIFIED
       ^             |
       +-------------+ (final unlink or explicit review)
Any editable state -> ARCHIVED -> restored DRAFT/NEEDS_EVIDENCE
```

VERIFIED means the workspace owner reviewed at least one linked fact. It is
not independent certification. Editing a verified statement clears that
state. Every revision and evidence-link change remains inspectable.

## Deterministic interpretation

Public sampled workflow/release/issue/PR summaries remain reproducible
arithmetic, never model output or a quality/productivity score. A workflow
run is not automatically a test; a PR record does not establish review
quality; an issue title does not establish full decision context.

## Boundaries

No RAG, embeddings, publication, ranking, scoring, seniority, productivity,
code execution, or GitHub writes exist.

Phase 4 creates private drafts only over explicitly selected known evidence
IDs. Every sentence must cite at least one selected ID. `VALID` is a mechanical
status: JSON shape, citation membership, evidence availability/version, text
bounds, and conservative policy checks passed. It is not a truth probability,
quality score, or certification. Caveats and unused-evidence counts remain
visible for owner review.
