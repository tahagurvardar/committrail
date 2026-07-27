# ADR 0003 — No developer ranking

- **Status:** Accepted
- **Date:** 2026-07-27
- **Phase:** 0 (binding for all phases)

## Context

Products built on developer activity data drift toward comparison features:
scores, percentiles, leaderboards, "top developer" badges, seniority
estimates, burnout meters. These features are commercially tempting and
methodologically indefensible — activity data measures visible cadence in
selected repositories, not competence, and proxies like commit counts
actively punish deep work, private work, and non-code contributions.

A portfolio tool that ranks its own users also inverts its loyalty: it stops
working for the developer and starts scoring them for someone else.

## Decision

CommitTrail never ranks, scores, or compares developers. Specifically, it
will not:

- compute or display any cross-developer ranking, percentile, or score;
- infer seniority or level;
- present commit counts, streaks, or volume as productivity or skill;
- estimate burnout, engagement, or working patterns;
- offer these to third parties (recruiters, employers) in any form.

Counts shown in the product describe **evidence volume and coverage** for
one developer's own claims (e.g., "412 commits ingested as evidence",
"8 of 10 claims fully linked") and are never framed as performance.

## Enforcement

- The boundary is stated in product copy (landing, about, methodology) and
  in the product spec as a hard requirement.
- Phase 0 tests assert the trust-principle copy is present; future review
  treats any ranking-shaped feature as out of scope by default, requiring a
  superseding ADR to even discuss.

## Consequences

- Some monetization paths (recruiter-side scoring, talent marketplaces) are
  permanently closed. Accepted.
- The product's trust story stays coherent: evidence for your claims, never
  judgment of your worth.
