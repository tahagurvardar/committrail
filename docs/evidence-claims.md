# Private evidence claims

Claims are private, repository-scoped, and controlled only by the workspace
owner. Statements are control-stripped plain text from 1 to 500 characters;
HTML and Markdown are rendered as text. Claims record `HUMAN` or
`AI_ASSISTED` origin, but have no publication or public-profile state.

States are DRAFT, NEEDS_EVIDENCE, VERIFIED, and ARCHIVED. A claim with no
links is NEEDS_EVIDENCE. Verification requires at least one available
same-repository fact and means only “reviewed by this workspace owner,” not
external certification. Editing a verified statement clears verification.
Removing the final link returns the claim to NEEDS_EVIDENCE. Archived claims
must be restored before editing.

Every mutation derives the personal workspace from the server session,
scopes repository/claim/evidence queries to it, uses a transaction and
optimistic version, writes a bounded append-only revision, and records a
minimal audit event. Composite database foreign keys require a claim and its
evidence to share the same tracked repository.

The evidence library supports type, title, date, and availability filters,
shows first/last seen and observation provenance, and discloses its bounded
sample. Claim detail provides an evidence picker, safe GitHub links, revision
history, explicit review controls, an accessible SVG relationship view, and
a complete textual graph equivalent.

Phase 4 candidates are not claims. Explicit acceptance links cited evidence and
creates or replaces a private claim with `AI_ASSISTED` origin and `DRAFT`
status. It never starts verified. Replacing a verified claim clears
verification; later human editing is recorded without erasing origin.
AI-assisted claim pages show candidate provenance, stale-evidence warnings, and
a review checklist. Verification remains an explicit evidence-linked owner
action.
