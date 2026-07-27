import type { RepositoryIdentifier } from "@/lib/github/types";

export const ACTIVITY_LIMITS = {
  commits: 20,
  pullRequests: 20,
  issues: 20,
  releases: 10,
  workflowRuns: 20,
} as const;

export type EvidenceType =
  "commit" | "pull-request" | "issue" | "release" | "workflow-run";

export interface EvidenceRecordBase {
  evidenceId: string;
  evidenceType: EvidenceType;
  sourceIdentifier: string;
  sourceUrl: string;
  occurredAt: string;
  title: string;
  source: "GitHub";
  confidence: "fact";
}

export interface CommitEvidence extends EvidenceRecordBase {
  evidenceType: "commit";
  sha: string;
  shortSha: string;
  committedAt: string;
  authorLogin: string | null;
  authorDisplayName: string | null;
  verification: "verified" | "unverified" | null;
}

export interface PullRequestEvidence extends EvidenceRecordBase {
  evidenceType: "pull-request";
  databaseId: number;
  number: number;
  state: "open" | "closed";
  draft: boolean;
  authorLogin: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  baseBranch: string;
  headBranch: string;
}

export interface IssueLabel {
  name: string;
  color: string | null;
}

export interface IssueEvidence extends EvidenceRecordBase {
  evidenceType: "issue";
  databaseId: number;
  number: number;
  state: "open" | "closed";
  stateReason: "completed" | "not_planned" | "reopened" | null;
  authorLogin: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  commentCount: number;
  labels: IssueLabel[];
}

export interface ReleaseEvidence extends EvidenceRecordBase {
  evidenceType: "release";
  databaseId: number;
  tagName: string;
  releaseName: string | null;
  draft: boolean;
  prerelease: boolean;
  immutable: boolean | null;
  createdAt: string;
  publishedAt: string | null;
  authorLogin: string | null;
  assetCount: number;
}

export interface WorkflowRunEvidence extends EvidenceRecordBase {
  evidenceType: "workflow-run";
  databaseId: number;
  workflowName: string;
  runNumber: number;
  event: string;
  status: string;
  conclusion: string | null;
  headBranch: string | null;
  headSha: string;
  createdAt: string;
  updatedAt: string;
  runStartedAt: string | null;
}

export type ActivityEvidence =
  | CommitEvidence
  | PullRequestEvidence
  | IssueEvidence
  | ReleaseEvidence
  | WorkflowRunEvidence;

export interface ActivityPagination {
  hasMore: boolean;
  returnedCount: number;
  sampleLimit: number;
}

export type ActivityUnavailableReason =
  | "rate-limited"
  | "upstream-unavailable"
  | "timeout"
  | "malformed-response"
  | "not-supported";

export type ActivitySection<T> =
  | {
      status: "available";
      items: T[];
      pagination: ActivityPagination;
      discardedRecordCount: number;
    }
  | {
      status: "unavailable";
      reason: ActivityUnavailableReason;
      retryAt: string | null;
    };

export interface PublicRepositoryActivity {
  repository: RepositoryIdentifier;
  fetchedAt: string;
  categoryUrls: {
    commits: string;
    pullRequests: string;
    issues: string;
    releases: string;
    workflowRuns: string;
  };
  commits: ActivitySection<CommitEvidence>;
  pullRequests: ActivitySection<PullRequestEvidence>;
  issues: ActivitySection<IssueEvidence>;
  releases: ActivitySection<ReleaseEvidence>;
  workflowRuns: ActivitySection<WorkflowRunEvidence>;
}

export interface RepositoryActivityContext {
  defaultBranch: string;
}
