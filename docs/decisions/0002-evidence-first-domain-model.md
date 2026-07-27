# ADR 0002 — Evidence-first domain model

- **Status:** Accepted
- **Date:** 2026-07-27
- **Phase:** 0

## Context

Portfolio tools usually generate narrative first and decorate it with data.
That ordering makes unverifiable claims the default output and turns any AI
assistance into a credibility liability. CommitTrail's entire value is the
opposite: claims a skeptical reader can audit.

## Decision

The domain model is ordered around evidence, and every later layer is
constrained by the one below it:

```
facts → evidence → deterministic derived metrics → ai-draft claims → user-approved published claims
```

Concretely (implemented in Phase 0 as `src/lib/demo/types.ts` and mirrored
by the future persistence schema):

- **Facts are append-only** and stored with stable identifiers (SHA, PR
  number, tag, run ID).
- **Claims reference evidence by ID**; a claim with no resolvable evidence
  cannot reach `verified` or `published` (the `needs-evidence` state exists
  precisely for this).
- **The deterministic layer is model-free.** Anything called a metric must
  be recomputable from its inputs.
- **The AI layer is evidence-grounded.** Drafts may only cite evidence IDs
  that exist; output citing unknown IDs is rejected mechanically, and drafts
  carry a permanent `ai-draft` confidence label until human review.
- **Publication is a review-state transition** performed by the author, not
  a side effect of generation.

## Consequences

- The UI can always show "where did this sentence come from", which is the
  product's differentiator.
- Ingestion — from the Phase 1 public snapshot through Phase 3 continuous
  sync — must preserve stable IDs and treat re-syncs as idempotent upserts,
  which constrains schema design early, deliberately.
- AI provider choice becomes an implementation detail behind a narrow
  boundary; no provider is named or integrated in Phase 0.
- Some attractive features (e.g., speculative "insights" without receipts)
  are permanently out of scope. That is intended.
