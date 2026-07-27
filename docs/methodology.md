# CommitTrail — Methodology

The user-facing version of this document lives at `/methodology` in the app.
This file is the canonical specification behind it.

## Why a methodology at all

CommitTrail's output is a set of claims about engineering work. Claims are
only useful if a skeptical reader can check them. The methodology exists to
make every step from repository history to published sentence inspectable —
and to bind the product to it.

## Vocabulary

| Term           | Definition                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Fact           | A record read directly from a repository and represented with a stable identifier; Phase 1B does not persist it. |
| Evidence       | A fact, file, or doc section linked to a claim as support. A reference, not a copy.                              |
| Derived metric | A number computed from facts by a reproducible rule — same input, same output, no model involved.                |
| Claim          | A human-readable statement carrying a confidence state, a review state, and evidence links.                      |

## The pipeline and its guarantees

1. **Facts are collected.** Read-only, user-selected repositories only.
   _Guarantee: nothing is ever written to GitHub._
2. **Evidence is pinned.** Records become evidence entries with permanent
   references (SHA, PR number, release tag, run ID, file@revision, doc
   anchor). _Guarantee: evidence is referenced, never paraphrased into
   place._
3. **Metrics are derived deterministically.** _Guarantee: any derived number
   can be recomputed from its inputs._
4. **Drafts are AI-assisted and say so.** A model may propose claims and
   case-study text only over collected evidence; output citing unknown
   evidence IDs is rejected mechanically. _Guarantee: drafts cannot invent
   receipts, and never publish themselves._
5. **The author approves.** Review happens claim-by-claim against evidence.
   _Guarantee: publication is always a human decision._

## Confidence states

| State           | Meaning                                           | Display rule                          |
| --------------- | ------------------------------------------------- | ------------------------------------- |
| `fact`          | Stated directly by repository records             | Solid treatment                       |
| `deterministic` | Computed by a reproducible rule                   | Outlined brand treatment              |
| `ai-draft`      | Proposed by an assistive model, awaiting judgment | Dashed amber treatment, explicit text |

The `ai-draft` label always names AI involvement in words ("AI-assisted
draft") — icon and color are reinforcement, never the only signal.

## Review states

`draft` → (`needs-evidence` ⇄) → `verified` → `published`

- `needs-evidence` blocks verification and publication until evidence is
  linked.
- Only `published` claims are ever publicly visible.
- Transitions happen only by explicit author action.

## Coverage rule

A claim counts as **covered** when it is past the needs-evidence gate and
links at least **2** independent evidence records
(`COVERAGE_MIN_EVIDENCE` in `src/lib/demo/derive.ts`). Coverage percentages
shown in the product are derived from this rule and recomputable.

## Evidence types and what the current record can establish

| Type           | Current Phase 1B fact boundary                                             |
| -------------- | -------------------------------------------------------------------------- |
| `commit`       | A SHA, first message line, commit time, source link, and safe author label |
| `pull-request` | List-record state/dates/branches; merged only with a supplied merged time  |
| `issue`        | Standalone issue list-record state, labels, comment count, and dates       |
| `release`      | Published tag/name, dates, prerelease/immutable flags, and asset count     |
| `workflow-run` | A workflow run’s event, status, conclusion, branch/SHA, and dates          |
| `file`         | Deferred; no source file is fetched in Phase 1B                            |
| `doc-section`  | Deferred; README is only a bounded plain-text snapshot excerpt             |

A workflow run is not automatically a test run. A PR list record does not
establish review quality or discussion. An issue title does not establish
full decision context. Release and commit bodies are not collected.

## Hard boundaries

CommitTrail will never: rank/score/compare developers, infer seniority,
treat commit counts as productivity, estimate burnout, execute repository
code, request GitHub write access, publish AI output automatically, or state
technical claims without evidence.

## Phase status

Phases 1A and 1B implement the first pipeline stage for real data:
`/explore` → `/repositories/[owner]/[repo]` shows metadata, language bytes, a
safe README excerpt, and product-owned Fact records from bounded page-one
activity windows. Stable evidence-candidate IDs use full commit SHA or GitHub
database ID, but nothing is persisted.

The only interpretation is explicit deterministic arithmetic over those
windows:

- workflow success is successful completed runs divided by **all** completed
  fetched runs; failed-like, other completed, and queued/in-progress counts
  remain separate;
- release interval is the median elapsed days between adjacent published,
  non-draft records, and requires at least three;
- issue and PR state counts describe only their fetched samples.

Every summary carries sample size, definition, source type, Deterministic
confidence, and limitation wording. Record windows are never described as
complete history; counts are never productivity or quality signals. Drafting,
review, persistence, and publishing remain synthetic/deferred.
