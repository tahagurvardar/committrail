import { describe, expect, it } from "vitest";

import {
  evidenceCoverage,
  evidenceTypesOf,
  inventoryTotal,
  milestonesForRepo,
} from "@/lib/demo/derive";
import type { Milestone } from "@/lib/demo/types";

function milestone(overrides: Partial<Milestone>): Milestone {
  return {
    id: "m",
    repoId: "repo",
    date: "2025-01-01",
    claim: "A claim.",
    confidence: "fact",
    review: "verified",
    evidence: [],
    ...overrides,
  };
}

describe("evidenceCoverage", () => {
  it("returns zeros (not NaN) for an empty list", () => {
    expect(evidenceCoverage([])).toEqual({ covered: 0, total: 0, percent: 0 });
  });

  it("requires both a reviewable state and two evidence links", () => {
    const result = evidenceCoverage([
      milestone({
        id: "covered",
        review: "verified",
        evidence: [
          { type: "commit", label: "abc1234", detail: "d" },
          { type: "release", label: "v1.0.0", detail: "d" },
        ],
      }),
      milestone({ id: "blocked", review: "needs-evidence", evidence: [] }),
      milestone({
        id: "thin",
        review: "draft",
        evidence: [{ type: "commit", label: "def5678", detail: "d" }],
      }),
    ]);
    expect(result).toEqual({ covered: 1, total: 3, percent: 33 });
  });
});

describe("milestonesForRepo", () => {
  it("filters by repository id", () => {
    const list = [
      milestone({ id: "a", repoId: "one" }),
      milestone({ id: "b", repoId: "two" }),
      milestone({ id: "c", repoId: "one" }),
    ];
    expect(milestonesForRepo(list, "one").map((m) => m.id)).toEqual(["a", "c"]);
  });
});

describe("evidenceTypesOf", () => {
  it("deduplicates types while preserving first-seen order", () => {
    const subject = milestone({
      evidence: [
        { type: "pull-request", label: "PR #1", detail: "d" },
        { type: "commit", label: "abc", detail: "d" },
        { type: "pull-request", label: "PR #2", detail: "d" },
      ],
    });
    expect(evidenceTypesOf(subject)).toEqual(["pull-request", "commit"]);
  });
});

describe("inventoryTotal", () => {
  it("sums every inventory bucket", () => {
    expect(
      inventoryTotal({
        commits: 1,
        pullRequests: 2,
        issues: 3,
        releases: 4,
        workflowRuns: 5,
        files: 6,
        docSections: 7,
      }),
    ).toBe(28);
  });
});
