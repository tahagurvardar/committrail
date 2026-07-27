import type {
  ActivityEvidence,
  IssueEvidence,
  PullRequestEvidence,
  ReleaseEvidence,
  WorkflowRunEvidence,
} from "@/lib/github/activity-types";

export interface DerivationMetadata {
  sampleSize: number;
  definition: string;
  sourceRecordTypes: string[];
  confidence: "deterministic";
  limitation: string;
}

export interface WorkflowOutcomeSummary extends DerivationMetadata {
  label: "Recent workflow outcomes";
  completedCount: number;
  successfulCount: number;
  failedLikeCount: number;
  otherCompletedCount: number;
  inProgressOrQueuedCount: number;
  completedSuccessPercent: number | null;
}

export interface ReleaseIntervalSummary extends DerivationMetadata {
  label: "Median interval between sampled published releases";
  medianDays: number;
}

export interface IssueStateSummary extends DerivationMetadata {
  label: "Recently returned standalone issue states";
  openCount: number;
  closedCount: number;
}

export interface PullRequestStateSummary extends DerivationMetadata {
  label: "Recently returned pull request states";
  openCount: number;
  closedCount: number;
  draftCount: number;
  mergedCount: number;
}

const FAILED_LIKE = new Set([
  "failure",
  "timed_out",
  "action_required",
  "startup_failure",
]);

export function deriveWorkflowOutcomes(
  records: readonly WorkflowRunEvidence[],
): WorkflowOutcomeSummary {
  const completed = records.filter((record) => record.status === "completed");
  const successfulCount = completed.filter(
    (record) => record.conclusion === "success",
  ).length;
  const failedLikeCount = completed.filter(
    (record) =>
      record.conclusion !== null && FAILED_LIKE.has(record.conclusion),
  ).length;
  const otherCompletedCount =
    completed.length - successfulCount - failedLikeCount;
  return {
    label: "Recent workflow outcomes",
    sampleSize: records.length,
    completedCount: completed.length,
    successfulCount,
    failedLikeCount,
    otherCompletedCount,
    inProgressOrQueuedCount: records.length - completed.length,
    completedSuccessPercent:
      completed.length === 0
        ? null
        : Math.round((successfulCount / completed.length) * 1000) / 10,
    definition:
      "Counts conclusions only among completed workflow runs; the percentage denominator is all completed runs in the fetched recent window.",
    sourceRecordTypes: ["workflow-run"],
    confidence: "deterministic",
    limitation:
      "This bounded sample describes workflow outcomes, not test coverage, reliability, code quality, or developer performance.",
  };
}

export function deriveReleaseInterval(
  records: readonly ReleaseEvidence[],
): ReleaseIntervalSummary | null {
  const published = records
    .filter(
      (record) =>
        !record.draft &&
        record.publishedAt !== null &&
        Number.isFinite(Date.parse(record.publishedAt)),
    )
    .map((record) => Date.parse(record.publishedAt as string))
    .sort((a, b) => a - b);
  if (published.length < 3) {
    return null;
  }
  const intervals = published
    .slice(1)
    .map((timestamp, index) => (timestamp - published[index]) / 86_400_000)
    .sort((a, b) => a - b);
  const middle = Math.floor(intervals.length / 2);
  const median =
    intervals.length % 2 === 1
      ? intervals[middle]
      : (intervals[middle - 1] + intervals[middle]) / 2;
  return {
    label: "Median interval between sampled published releases",
    sampleSize: published.length,
    medianDays: Math.round(median * 10) / 10,
    definition:
      "Median elapsed days between adjacent published, non-draft releases after sorting the fetched sample by published timestamp.",
    sourceRecordTypes: ["release"],
    confidence: "deterministic",
    limitation:
      "This recent sample is not the repository’s complete release history and does not measure team speed, maturity, consistency, or quality.",
  };
}

export function deriveIssueStates(
  records: readonly IssueEvidence[],
): IssueStateSummary {
  return {
    label: "Recently returned standalone issue states",
    sampleSize: records.length,
    openCount: records.filter((record) => record.state === "open").length,
    closedCount: records.filter((record) => record.state === "closed").length,
    definition:
      "Counts open and closed states among standalone issues in the fetched recent window after pull-request records are removed.",
    sourceRecordTypes: ["issue"],
    confidence: "deterministic",
    limitation:
      "This is a bounded sample, not the repository’s total issue history or a judgment about maintenance.",
  };
}

export function derivePullRequestStates(
  records: readonly PullRequestEvidence[],
): PullRequestStateSummary {
  return {
    label: "Recently returned pull request states",
    sampleSize: records.length,
    openCount: records.filter((record) => record.state === "open").length,
    closedCount: records.filter((record) => record.state === "closed").length,
    draftCount: records.filter((record) => record.draft).length,
    mergedCount: records.filter((record) => record.mergedAt !== null).length,
    definition:
      "Counts states in the fetched recent pull-request window; merged means GitHub supplied a merged timestamp.",
    sourceRecordTypes: ["pull-request"],
    confidence: "deterministic",
    limitation:
      "This sample does not measure review quality, delivery performance, scope, or complexity.",
  };
}

export function buildRecentTimeline(
  groups: readonly (readonly ActivityEvidence[])[],
  limit = 30,
): ActivityEvidence[] {
  return groups
    .flat()
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        a.evidenceId.localeCompare(b.evidenceId),
    )
    .slice(0, limit);
}
