import { describe, expect, it } from "vitest";

import {
  buildRecentTimeline,
  deriveIssueStates,
  derivePullRequestStates,
  deriveReleaseInterval,
  deriveWorkflowOutcomes,
} from "@/lib/github/activity-derivations";
import type {
  ActivityEvidence,
  IssueEvidence,
  PullRequestEvidence,
  ReleaseEvidence,
  WorkflowRunEvidence,
} from "@/lib/github/activity-types";

function workflow(
  id: number,
  status: string,
  conclusion: string | null,
): WorkflowRunEvidence {
  return {
    evidenceId: `github:workflow-run:${id}`,
    evidenceType: "workflow-run",
    sourceIdentifier: String(id),
    sourceUrl: `https://github.com/acme/rocket/actions/runs/${id}`,
    occurredAt: "2026-07-27T00:00:00.000Z",
    title: "CI",
    source: "GitHub",
    confidence: "fact",
    databaseId: id,
    workflowName: "CI",
    runNumber: id,
    event: "push",
    status,
    conclusion,
    headBranch: "main",
    headSha: "a".repeat(40),
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:01:00.000Z",
    runStartedAt: null,
  };
}

function release(id: number, day: number, draft = false): ReleaseEvidence {
  const publishedAt = new Date(Date.UTC(2026, 0, day + 1)).toISOString();
  return {
    evidenceId: `github:release:${id}`,
    evidenceType: "release",
    sourceIdentifier: String(id),
    sourceUrl: `https://github.com/acme/rocket/releases/tag/v${id}`,
    occurredAt: publishedAt,
    title: `v${id}`,
    source: "GitHub",
    confidence: "fact",
    databaseId: id,
    tagName: `v${id}`,
    releaseName: null,
    draft,
    prerelease: false,
    immutable: null,
    createdAt: publishedAt,
    publishedAt,
    authorLogin: null,
    assetCount: 0,
  };
}

function issue(id: number, state: "open" | "closed"): IssueEvidence {
  return {
    evidenceId: `github:issue:${id}`,
    evidenceType: "issue",
    sourceIdentifier: String(id),
    sourceUrl: `https://github.com/acme/rocket/issues/${id}`,
    occurredAt: "2026-07-27T00:00:00.000Z",
    title: `Issue ${id}`,
    source: "GitHub",
    confidence: "fact",
    databaseId: id,
    number: id,
    state,
    stateReason: null,
    authorLogin: null,
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    closedAt: state === "closed" ? "2026-07-27T00:00:00.000Z" : null,
    commentCount: 0,
    labels: [],
  };
}

function pull(
  id: number,
  state: "open" | "closed",
  draft: boolean,
  merged: boolean,
): PullRequestEvidence {
  return {
    evidenceId: `github:pull-request:${id}`,
    evidenceType: "pull-request",
    sourceIdentifier: String(id),
    sourceUrl: `https://github.com/acme/rocket/pull/${id}`,
    occurredAt: "2026-07-27T00:00:00.000Z",
    title: `PR ${id}`,
    source: "GitHub",
    confidence: "fact",
    databaseId: id,
    number: id,
    state,
    draft,
    authorLogin: null,
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    closedAt: state === "closed" ? "2026-07-27T00:00:00.000Z" : null,
    mergedAt: merged ? "2026-07-27T00:00:00.000Z" : null,
    baseBranch: "main",
    headBranch: "feature",
  };
}

describe("activity derivations", () => {
  it("uses all completed workflow runs as the success denominator", () => {
    const summary = deriveWorkflowOutcomes([
      workflow(1, "completed", "success"),
      workflow(2, "completed", "failure"),
      workflow(3, "completed", "cancelled"),
      workflow(4, "queued", null),
    ]);
    expect(summary).toMatchObject({
      sampleSize: 4,
      completedCount: 3,
      successfulCount: 1,
      failedLikeCount: 1,
      otherCompletedCount: 1,
      inProgressOrQueuedCount: 1,
      completedSuccessPercent: 33.3,
      confidence: "deterministic",
    });
    expect(summary.definition).toMatch(/denominator is all completed runs/i);
  });

  it("returns no workflow percentage for a zero completed denominator", () => {
    const summary = deriveWorkflowOutcomes([
      workflow(1, "queued", null),
      workflow(2, "in_progress", null),
    ]);
    expect(summary.completedCount).toBe(0);
    expect(summary.completedSuccessPercent).toBeNull();
    expect(summary.inProgressOrQueuedCount).toBe(2);
  });

  it("calculates the median for an odd number of release intervals", () => {
    const summary = deriveReleaseInterval([
      release(1, 0),
      release(2, 1),
      release(3, 5),
      release(4, 14),
    ]);
    expect(summary).toMatchObject({ sampleSize: 4, medianDays: 4 });
  });

  it("calculates the median for an even number of release intervals", () => {
    const summary = deriveReleaseInterval([
      release(1, 0),
      release(2, 2),
      release(3, 10),
    ]);
    expect(summary).toMatchObject({ sampleSize: 3, medianDays: 5 });
  });

  it("requires three published non-draft releases and excludes drafts", () => {
    expect(deriveReleaseInterval([release(1, 0), release(2, 2)])).toBeNull();
    expect(
      deriveReleaseInterval([
        release(1, 0),
        release(2, 2),
        release(3, 4, true),
      ]),
    ).toBeNull();
  });

  it("counts open and closed standalone issue sample states", () => {
    expect(
      deriveIssueStates([issue(1, "open"), issue(2, "closed")]),
    ).toMatchObject({
      sampleSize: 2,
      openCount: 1,
      closedCount: 1,
    });
  });

  it("counts PR state, draft, and only reliably merged records", () => {
    expect(
      derivePullRequestStates([
        pull(1, "open", true, false),
        pull(2, "closed", false, true),
        pull(3, "closed", false, false),
      ]),
    ).toMatchObject({
      sampleSize: 3,
      openCount: 1,
      closedCount: 2,
      draftCount: 1,
      mergedCount: 1,
    });
  });

  it("is deterministic under source record reordering", () => {
    const records = [release(1, 0), release(2, 2), release(3, 10)];
    expect(deriveReleaseInterval(records)).toEqual(
      deriveReleaseInterval([records[2], records[0], records[1]]),
    );
  });

  it("sorts the unified timeline descending with stable evidence-ID ties and caps it", () => {
    const records = [
      { ...issue(2, "open"), occurredAt: "2026-07-27T10:00:00.000Z" },
      { ...issue(1, "open"), occurredAt: "2026-07-27T10:00:00.000Z" },
      { ...issue(3, "open"), occurredAt: "2026-07-27T09:00:00.000Z" },
    ] satisfies ActivityEvidence[];
    expect(
      buildRecentTimeline([records], 2).map((item) => item.evidenceId),
    ).toEqual(["github:issue:1", "github:issue:2"]);
  });

  it("exposes definitions and limitations without any score or ranking field", () => {
    const summaries = [
      deriveWorkflowOutcomes([]),
      deriveIssueStates([]),
      derivePullRequestStates([]),
      deriveReleaseInterval([release(1, 0), release(2, 2), release(3, 10)]),
    ];
    const serialized = JSON.stringify(summaries);
    expect(serialized).not.toMatch(/"score"|"ranking"|"health"/i);
    expect(serialized).toMatch(/bounded sample|fetched recent window/i);
  });
});
