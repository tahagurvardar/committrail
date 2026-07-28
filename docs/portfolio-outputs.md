# Deterministic portfolio outputs

Phase 5 includes three private builders:

- `CASE_STUDY`: user-authored overview, context, role, approach, outcomes, learning, limitations, and ordered verified claims.
- `CV_BULLETS`: one to six exact reviewed claim statements or owner-edited bounded variants linked to those claims.
- `INTERVIEW_STORY`: user-authored Situation, Task, Action, Result, and Reflection fields with ordered verified claims.

Builders use deterministic templates and never call a model provider. They do not invent metrics, percentages, business impact, scope, rankings, productivity, seniority, or quality. Saved revisions are append-only and retain private provenance.

Authenticated downloads support TXT, CommitTrail-generated escaped Markdown, and versioned JSON. Downloads use opaque output IDs, workspace-scoped authorization, safe filenames, bounded bodies, attachment disposition, `private, no-store`, and no provider, authentication, or raw GitHub secrets.

Outputs remain private. A case study becomes public only when its reviewed material is deliberately included in a separate ProjectPublication.
