# ADR 0019: AI-assisted drafts never auto-verify claims

A validated candidate is only a suggestion. Acceptance is explicit, creates or
replaces a private `AI_ASSISTED` claim in `DRAFT`, links cited evidence, and
clears existing verification. Only the authenticated workspace owner can later
verify after human review. Providers cannot invoke claim services.
