# CommitTrail — Product Specification

_Phase 0 revision._

## One-line definition

CommitTrail turns GitHub history into evidence-backed engineering stories:
reviewed milestones and case studies where every technical claim links to
concrete repository records.

## Problem

1. **Raw GitHub profiles are difficult to interpret.** The real signal —
   decisions, migrations, performance work — is buried under repository
   lists and activity tiles.
2. **Commit counts alone are misleading.** Volume metrics measure cadence,
   not engineering quality, and reward the wrong behavior when read as
   productivity.
3. **AI summaries without evidence are difficult to trust.** Generated
   portfolio text that cites nothing cannot be distinguished from
   invention, so reviewers discount it entirely.

## Audience

- Developers who want a defensible portfolio: job seekers, freelancers,
  open-source maintainers.
- Secondary readers of their output: recruiters, hiring managers,
  interviewers, clients.

## Core model

```
GitHub facts
  → normalized evidence
    → deterministic derived metrics
      → AI-assisted draft claims
        → user-approved published claims
```

Each arrow narrows what the next stage may do:

| Stage             | May do                                         | May never do                        |
| ----------------- | ---------------------------------------------- | ----------------------------------- |
| Facts             | Read via read-only GitHub access               | Write to GitHub                     |
| Evidence          | Reference records by stable IDs                | Paraphrase or mutate records        |
| Derived metrics   | Recomputable rules over evidence               | Involve a model                     |
| AI-assisted draft | Propose claims grounded in existing evidence   | Cite non-existent evidence; publish |
| Published claims  | Appear publicly after explicit author approval | Publish without a human decision    |

## Domain vocabulary

- **Fact** — a record read directly from a repository (commit, PR, issue,
  release, workflow run), stored with stable identifiers, never edited.
- **Evidence** — a fact, file, or documentation section linked to a claim as
  support; a reference, not a copy.
- **Derived metric** — a number computed deterministically from facts
  (language evolution, CI pass rate, release cadence).
- **Claim** — a human-readable statement (typically a milestone) carrying a
  confidence state, a review state, and evidence links.

### Evidence types

`commit`, `pull-request`, `issue`, `release`, `workflow-run`, `file`,
`doc-section`.

### Confidence states

- `fact` — stated directly by records.
- `deterministic` — computed by a reproducible rule.
- `ai-draft` — proposed by an assistive model, visibly labeled until
  reviewed.

### Review states

- `draft` — exists, unreviewed, private.
- `needs-evidence` — blocked until evidence is linked.
- `verified` — author confirmed the claim against its evidence.
- `published` — verified and explicitly approved for a public page; the only
  publicly visible state.

## Product boundaries (hard requirements)

CommitTrail must not:

- rank, score, or compare developers;
- infer seniority;
- treat commit count as productivity;
- estimate burnout or working patterns;
- execute repository code;
- request GitHub write access;
- automatically publish AI output;
- make unsupported technical claims.

These boundaries appear in product copy (landing, about, methodology) and are
treated as requirements in review.

## Phase 0 scope

**In:** landing page, synthetic demo dashboard, about, methodology,
not-found; design system (tokens, dark mode, accessibility); typed demo
domain model with deterministic fixtures and derivations; documentation; unit
and component tests; CI; Playwright preparation.

**Out (explicitly):** GitHub authentication and APIs, GitHub Apps, webhooks,
PostgreSQL/Prisma, background jobs, external AI providers, billing, private
repositories, deployment.

## Demo requirements (implemented)

The `/demo` route uses deterministic synthetic data only — a fictional
developer and three fictional repositories — and shows: profile summary,
repository selector, repository overview, engineering timeline with
evidence-backed milestone cards (claim, date, evidence count and types,
confidence state, review state, disabled source-link controls), language
evolution, release activity, pull-request activity, CI evidence, an evidence
coverage indicator, a draft case-study preview, and an explicit
synthetic-demo banner.

## Success criteria for later phases

- Every published claim resolves to at least one live, checkable GitHub
  record.
- A reviewer can audit any claim in under a minute from its public page.
- Zero write scopes requested, ever.
