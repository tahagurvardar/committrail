# Private draft review workflow

Draft routes are authenticated, dynamic, private, and `no-store`.

- The list shows intent, style, provider classification, queue state, evidence
  count, timing, review status, grounding status, sanitized failure code, and
  accepted claim.
- The request form shows disabled/local/external disclosure, exact limits,
  external consent controls, intent/style inputs, evidence filters, and an
  explicit evidence picker.
- The detail page shows the immutable candidate sentence by sentence, each
  sentence’s source evidence, caveats, mechanical grounding coverage, policy
  warnings, provider label/classification, template/bundle versions, timing,
  rejection history, and acceptance controls.

`READY` candidates may be rejected or explicitly accepted. Regeneration creates
a separate immutable request. Acceptance is transactional and idempotent: one
candidate can map to only one claim. It creates an `AI_ASSISTED` claim or
replaces an editable same-repository claim, links cited evidence, clears prior
verification, and starts in `DRAFT`. Human edits are recorded without erasing
the AI-assisted origin. Verification remains the existing explicit
workspace-owner action after reviewing wording, evidence links, unsupported
claims, and caveats.

Candidates never publish, verify, overwrite without an explicit owner action,
or become public. Publishing and portfolio outputs remain Phase 5.
