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

## Human-authored claims

Phase 3 claims are plain-text owner statements, never generated. The owner
selects same-repository evidence and reviews the relationship.

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

No AI drafting, RAG, embeddings, publication, ranking, scoring, seniority,
productivity, code execution, or GitHub writes exist in Phase 3. Phase 4 may
propose grounded drafts only over known evidence IDs and must preserve owner
review.
