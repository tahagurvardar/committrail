import { PublicRepositoryProviderError } from "@/lib/github/errors";
import { safePublicText } from "@/lib/github/safe-public-text";
import type {
  CommitEvidence,
  IssueEvidence,
  IssueLabel,
  PullRequestEvidence,
  ReleaseEvidence,
  WorkflowRunEvidence,
} from "@/lib/github/activity-types";
import type { RepositoryIdentifier } from "@/lib/github/types";

const FULL_SHA = /^[0-9a-f]{40}$/i;
const LABEL_COLOR = /^[0-9a-f]{6}$/i;
const WORKFLOW_STATUSES = new Set([
  "requested",
  "waiting",
  "pending",
  "queued",
  "in_progress",
  "completed",
]);
const WORKFLOW_CONCLUSIONS = new Set([
  "success",
  "failure",
  "neutral",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required",
  "stale",
  "startup_failure",
]);

interface MappedRecords<T> {
  items: T[];
  discardedRecordCount: number;
}

export function mapCommitResponse(
  raw: unknown,
  repository: RepositoryIdentifier,
): MappedRecords<CommitEvidence> {
  return mapArray(raw, (value) => mapCommit(value, repository), "commits");
}

export function mapPullRequestResponse(
  raw: unknown,
  repository: RepositoryIdentifier,
): MappedRecords<PullRequestEvidence> {
  return mapArray(
    raw,
    (value) => mapPullRequest(value, repository),
    "pull requests",
  );
}

export function mapIssueResponse(
  raw: unknown,
  repository: RepositoryIdentifier,
): MappedRecords<IssueEvidence> {
  if (!Array.isArray(raw)) {
    throw malformed("issues");
  }
  const standalone = raw.filter(
    (value) => !isRecord(value) || !("pull_request" in value),
  );
  return mapArray(standalone, (value) => mapIssue(value, repository), "issues");
}

export function mapReleaseResponse(
  raw: unknown,
  repository: RepositoryIdentifier,
): MappedRecords<ReleaseEvidence> {
  if (!Array.isArray(raw)) {
    throw malformed("releases");
  }
  // Even if an operator token can see drafts, this public page only shows
  // published records. Drafts are neither displayed nor counted as malformed.
  const published = raw.filter(
    (value) => !isRecord(value) || value.draft !== true,
  );
  return mapArray(
    published,
    (value) => mapRelease(value, repository),
    "releases",
  );
}

export function mapWorkflowRunResponse(
  raw: unknown,
  repository: RepositoryIdentifier,
): MappedRecords<WorkflowRunEvidence> {
  const wrapper = expectRecord(raw);
  if (
    expectNonNegativeInteger(wrapper.total_count) === null ||
    !Array.isArray(wrapper.workflow_runs)
  ) {
    throw malformed("workflow runs");
  }
  return mapArray(
    wrapper.workflow_runs,
    (value) => mapWorkflowRun(value, repository),
    "workflow runs",
  );
}

function mapArray<T>(
  raw: unknown,
  mapper: (value: unknown) => T | null,
  field: string,
): MappedRecords<T> {
  if (!Array.isArray(raw)) {
    throw malformed(field);
  }
  const items: T[] = [];
  let discardedRecordCount = 0;
  for (const value of raw) {
    const item = mapper(value);
    if (item === null) {
      discardedRecordCount += 1;
    } else {
      items.push(item);
    }
  }
  return { items, discardedRecordCount };
}

function mapCommit(
  value: unknown,
  repository: RepositoryIdentifier,
): CommitEvidence | null {
  const record = asRecord(value);
  const commit = asRecord(record?.commit);
  const commitAuthor = asRecord(commit?.author);
  const sha = expectSha(record?.sha);
  const title = safePublicText(commit?.message, 180, { firstLine: true });
  const committedAt = expectIso(commitAuthor?.date);
  const sourceUrl =
    sha === null
      ? null
      : safeRepositoryUrl(record?.html_url, repository, `/commit/${sha}`);
  if (
    record === null ||
    commit === null ||
    commitAuthor === null ||
    sha === null ||
    title === null ||
    committedAt === null ||
    sourceUrl === null
  ) {
    return null;
  }

  const upstreamAuthor = asRecord(record.author);
  const authorLogin = safePublicText(upstreamAuthor?.login, 80);
  const authorDisplayName =
    authorLogin === null ? safePublicText(commitAuthor.name, 100) : null;
  const verification = asRecord(commit.verification);
  const verified =
    typeof verification?.verified === "boolean"
      ? verification.verified
        ? "verified"
        : "unverified"
      : null;

  return {
    evidenceId: `github:commit:${sha.toLowerCase()}`,
    evidenceType: "commit",
    sourceIdentifier: sha.toLowerCase(),
    sourceUrl,
    occurredAt: committedAt,
    title,
    source: "GitHub",
    confidence: "fact",
    sha: sha.toLowerCase(),
    shortSha: sha.slice(0, 7).toLowerCase(),
    committedAt,
    authorLogin,
    authorDisplayName,
    verification: verified,
  };
}

function mapPullRequest(
  value: unknown,
  repository: RepositoryIdentifier,
): PullRequestEvidence | null {
  const record = asRecord(value);
  const base = asRecord(record?.base);
  const head = asRecord(record?.head);
  const databaseId = expectPositiveInteger(record?.id);
  const number = expectPositiveInteger(record?.number);
  const title = safePublicText(record?.title, 180);
  const state = expectEnum(record?.state, ["open", "closed"] as const);
  const draft = typeof record?.draft === "boolean" ? record.draft : null;
  const createdAt = expectIso(record?.created_at);
  const updatedAt = expectIso(record?.updated_at);
  const closedAt = expectNullableIso(record?.closed_at);
  const mergedAt = expectNullableIso(record?.merged_at);
  const sourceUrl =
    number === null
      ? null
      : safeRepositoryUrl(record?.html_url, repository, `/pull/${number}`);
  const baseBranch = safePublicText(base?.ref, 150);
  const headBranch = safePublicText(head?.ref, 150);
  if (
    databaseId === null ||
    number === null ||
    title === null ||
    state === null ||
    draft === null ||
    createdAt === null ||
    updatedAt === null ||
    closedAt === undefined ||
    mergedAt === undefined ||
    sourceUrl === null ||
    baseBranch === null ||
    headBranch === null
  ) {
    return null;
  }

  return {
    evidenceId: `github:pull-request:${databaseId}`,
    evidenceType: "pull-request",
    sourceIdentifier: String(databaseId),
    sourceUrl,
    occurredAt: updatedAt,
    title,
    source: "GitHub",
    confidence: "fact",
    databaseId,
    number,
    state,
    draft,
    authorLogin: safeLogin(record?.user),
    createdAt,
    updatedAt,
    closedAt,
    mergedAt,
    baseBranch,
    headBranch,
  };
}

function mapIssue(
  value: unknown,
  repository: RepositoryIdentifier,
): IssueEvidence | null {
  const record = asRecord(value);
  const databaseId = expectPositiveInteger(record?.id);
  const number = expectPositiveInteger(record?.number);
  const title = safePublicText(record?.title, 180);
  const state = expectEnum(record?.state, ["open", "closed"] as const);
  const stateReason =
    record?.state_reason === null || record?.state_reason === undefined
      ? null
      : expectEnum(record.state_reason, [
          "completed",
          "not_planned",
          "reopened",
        ] as const);
  const createdAt = expectIso(record?.created_at);
  const updatedAt = expectIso(record?.updated_at);
  const closedAt = expectNullableIso(record?.closed_at);
  const commentCount = expectNonNegativeInteger(record?.comments);
  const sourceUrl =
    number === null
      ? null
      : safeRepositoryUrl(record?.html_url, repository, `/issues/${number}`);
  const labels = mapLabels(record?.labels);
  if (
    databaseId === null ||
    number === null ||
    title === null ||
    state === null ||
    (record?.state_reason !== null &&
      record?.state_reason !== undefined &&
      stateReason === null) ||
    createdAt === null ||
    updatedAt === null ||
    closedAt === undefined ||
    commentCount === null ||
    sourceUrl === null ||
    labels === null
  ) {
    return null;
  }

  return {
    evidenceId: `github:issue:${databaseId}`,
    evidenceType: "issue",
    sourceIdentifier: String(databaseId),
    sourceUrl,
    occurredAt: updatedAt,
    title,
    source: "GitHub",
    confidence: "fact",
    databaseId,
    number,
    state,
    stateReason,
    authorLogin: safeLogin(record?.user),
    createdAt,
    updatedAt,
    closedAt,
    commentCount,
    labels,
  };
}

function mapRelease(
  value: unknown,
  repository: RepositoryIdentifier,
): ReleaseEvidence | null {
  const record = asRecord(value);
  const databaseId = expectPositiveInteger(record?.id);
  const tagName = safePublicText(record?.tag_name, 120);
  const releaseName =
    record?.name === null ? null : safePublicText(record?.name, 180);
  const draft = typeof record?.draft === "boolean" ? record.draft : null;
  const prerelease =
    typeof record?.prerelease === "boolean" ? record.prerelease : null;
  const immutable =
    record?.immutable === undefined
      ? null
      : typeof record.immutable === "boolean"
        ? record.immutable
        : undefined;
  const createdAt = expectIso(record?.created_at);
  const publishedAt = expectNullableIso(record?.published_at);
  const sourceUrl = safeRepositoryUrl(
    record?.html_url,
    repository,
    "/releases/tag/",
    true,
  );
  const assetCount = Array.isArray(record?.assets)
    ? record.assets.length
    : null;
  if (
    databaseId === null ||
    tagName === null ||
    (record?.name !== null && releaseName === null) ||
    draft === null ||
    prerelease === null ||
    immutable === undefined ||
    createdAt === null ||
    publishedAt === undefined ||
    sourceUrl === null ||
    assetCount === null
  ) {
    return null;
  }

  return {
    evidenceId: `github:release:${databaseId}`,
    evidenceType: "release",
    sourceIdentifier: String(databaseId),
    sourceUrl,
    occurredAt: publishedAt ?? createdAt,
    title: releaseName ?? tagName,
    source: "GitHub",
    confidence: "fact",
    databaseId,
    tagName,
    releaseName,
    draft,
    prerelease,
    immutable,
    createdAt,
    publishedAt,
    authorLogin: safeLogin(record?.author),
    assetCount,
  };
}

function mapWorkflowRun(
  value: unknown,
  repository: RepositoryIdentifier,
): WorkflowRunEvidence | null {
  const record = asRecord(value);
  const databaseId = expectPositiveInteger(record?.id);
  const workflowName = safePublicText(record?.name, 160);
  const runNumber = expectPositiveInteger(record?.run_number);
  const event = safePublicText(record?.event, 80);
  const status =
    typeof record?.status === "string" && WORKFLOW_STATUSES.has(record.status)
      ? record.status
      : null;
  const conclusion =
    record?.conclusion === null
      ? null
      : typeof record?.conclusion === "string" &&
          WORKFLOW_CONCLUSIONS.has(record.conclusion)
        ? record.conclusion
        : undefined;
  const headBranch =
    record?.head_branch === null
      ? null
      : safePublicText(record?.head_branch, 150);
  const headSha = expectSha(record?.head_sha);
  const createdAt = expectIso(record?.created_at);
  const updatedAt = expectIso(record?.updated_at);
  const runStartedAt = expectNullableIso(record?.run_started_at);
  const sourceUrl =
    databaseId === null
      ? null
      : safeRepositoryUrl(
          record?.html_url,
          repository,
          `/actions/runs/${databaseId}`,
        );
  if (
    databaseId === null ||
    workflowName === null ||
    runNumber === null ||
    event === null ||
    status === null ||
    conclusion === undefined ||
    (record?.head_branch !== null && headBranch === null) ||
    headSha === null ||
    createdAt === null ||
    updatedAt === null ||
    runStartedAt === undefined ||
    sourceUrl === null
  ) {
    return null;
  }

  return {
    evidenceId: `github:workflow-run:${databaseId}`,
    evidenceType: "workflow-run",
    sourceIdentifier: String(databaseId),
    sourceUrl,
    occurredAt: runStartedAt ?? createdAt,
    title: workflowName,
    source: "GitHub",
    confidence: "fact",
    databaseId,
    workflowName,
    runNumber,
    event,
    status,
    conclusion,
    headBranch,
    headSha: headSha.toLowerCase(),
    createdAt,
    updatedAt,
    runStartedAt,
  };
}

function mapLabels(value: unknown): IssueLabel[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const labels: IssueLabel[] = [];
  for (const raw of value.slice(0, 20)) {
    const record = asRecord(raw);
    const name = safePublicText(record?.name, 80);
    if (name === null) {
      continue;
    }
    labels.push({
      name,
      color:
        typeof record?.color === "string" && LABEL_COLOR.test(record.color)
          ? record.color.toLowerCase()
          : null,
    });
  }
  return labels;
}

function safeLogin(value: unknown): string | null {
  return safePublicText(asRecord(value)?.login, 80);
}

function safeRepositoryUrl(
  value: unknown,
  repository: RepositoryIdentifier,
  requiredPathPart: string,
  prefixMatch = false,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    const expectedPath =
      `/${repository.owner}/${repository.repo}${requiredPathPart}`.toLowerCase();
    const actualPath = url.pathname.toLowerCase().replace(/\/$/, "");
    const normalizedExpected = expectedPath.replace(/\/$/, "");
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com" ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      (prefixMatch
        ? !actualPath.startsWith(expectedPath)
        : actualPath !== normalizedExpected)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw malformed("activity");
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function expectNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function expectSha(value: unknown): string | null {
  return typeof value === "string" && FULL_SHA.test(value) ? value : null;
}

function expectIso(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function expectNullableIso(value: unknown): string | null | undefined {
  return value === null ? null : (expectIso(value) ?? undefined);
}

function expectEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : null;
}

function malformed(field: string): PublicRepositoryProviderError {
  return new PublicRepositoryProviderError(
    "malformed-response",
    `GitHub returned a malformed ${field} response.`,
  );
}
