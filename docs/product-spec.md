# CommitTrail — Product Specification

_Phase 2 revision._

Phase 2 retains the account-free public explorer and adds Better Auth
email/password identity, database sessions, a personal workspace, verified
read-only GitHub App connection, bounded selected-repository discovery,
persisted public/private normalized evidence, manual idempotent sync,
versioned export, local disconnect, and account deletion. Email delivery,
webhooks, background jobs, claims, publishing, teams, billing, and AI remain
out of scope.

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
  release, workflow run), represented with a stable identifier and never
  edited. Phase 1B does not persist it.
- **Evidence** — a fact, file, or documentation section linked to a claim as
  support; a reference, not a copy.
- **Derived metric** — a number computed deterministically from facts with a
  visible definition, denominator/sample size, and limitation.
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

## Implemented scope

**Phase 0 (done):** landing page, synthetic demo dashboard, about,
methodology, not-found; design system (tokens, dark mode, accessibility);
typed demo domain model with deterministic fixtures and derivations;
documentation; unit and component tests; CI; Playwright preparation.

**Phase 1A (done):** public repository input (`/explore`) accepting
`owner/repository` and github.com URL forms with strict validation (the
SSRF boundary); a server-only `PublicRepositoryProvider` interface with a
GitHub REST implementation (metadata, languages, README — native fetch,
fixed API base, optional server-only `GITHUB_TOKEN`); a read-only snapshot
route (`/repositories/[owner]/[repo]`) showing direct facts with the Fact
confidence treatment; honest typed failure states (not-found-or-
inaccessible, rate-limited with GitHub-provided retry timing when available,
timeout, upstream unavailable, configuration, malformed response);
success-only ~5-minute normalized snapshot caching with a visible freshness
disclosure; fixture-backed deterministic tests throughout.

**Phase 1B (done):** a separate server-only
`PublicRepositoryActivityProvider` normalizes five bounded, page-one sources:
20 commits on the default branch, 20 pull requests, 20 issue-endpoint records
(with PR markers filtered), 10 releases, and 20 workflow runs. Each becomes a
product-owned Fact evidence candidate with a stable ID, canonical GitHub URL,
occurrence timestamp, and bounded safe text. At most two activity requests run
concurrently; a full uncached page costs at most eight GitHub GETs including
Phase 1A. Pagination metadata only discloses whether more may exist and is
never followed.

The repository route now shows an activity overview, a unified timeline
capped at 30 records, category details, partial source availability, and four
strictly deterministic sampled summaries: workflow conclusion counts and a
success ratio over all completed fetched runs; median adjacent interval for
at least three published non-draft releases; standalone issue states; and
pull-request states (merged only when `merged_at` exists). These are bounded
samples, never complete history, quality, reliability, productivity, or
performance claims. Fully available activity uses a separate success-only
~5-minute cache; partial results remain visible but bypass caching.

**Out (explicitly, still):** GitHub authentication, GitHub Apps, webhooks,
PostgreSQL/Prisma, background jobs, external AI providers, billing, private
repositories, deployment, full-history crawling, contributor data, source
analysis, diffs, reviews, comments, jobs/logs/artifacts, scoring, milestone or
case-study generation, and AI summaries. The real repository UI labels its
bounded scope and never fabricates deferred capabilities.

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
