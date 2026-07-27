export const SUPPORTED_WEBHOOK_EVENTS = [
  "ping",
  "push",
  "pull_request",
  "issues",
  "release",
  "workflow_run",
  "repository",
  "installation",
  "installation_repositories",
] as const;

export type SupportedWebhookEvent = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

export interface MinimalWebhookEnvelope {
  event: string;
  action: string | null;
  installationId: bigint | null;
  repositoryId: bigint | null;
  repositoryOwner: string | null;
  repositoryName: string | null;
  ref: string | null;
  deleted: boolean | null;
  forced: boolean | null;
  sourceGithubId: string | null;
  installationAccountId: bigint | null;
  addedRepositoryIds: string[];
  removedRepositoryIds: string[];
  issueHasPullRequestMarker: boolean;
}

export interface RoutedWebhookJob {
  kind:
    | "REPOSITORY_METADATA"
    | "COMMITS"
    | "PULL_REQUESTS"
    | "ISSUES"
    | "RELEASES"
    | "WORKFLOW_RUNS"
    | "INSTALLATION_STATE"
    | "INSTALLATION_REPOSITORIES";
  payload: Record<string, string | boolean | string[] | null>;
}

export type WebhookRoutingDecision =
  { type: "ignored"; reason: string } | { type: "job"; job: RoutedWebhookJob };

const PR_ACTIONS = new Set([
  "opened",
  "reopened",
  "edited",
  "synchronize",
  "ready_for_review",
  "converted_to_draft",
  "closed",
]);
const ISSUE_ACTIONS = new Set([
  "opened",
  "edited",
  "closed",
  "reopened",
  "labeled",
  "unlabeled",
  "transferred",
]);
const RELEASE_ACTIONS = new Set([
  "published",
  "released",
  "prereleased",
  "edited",
  "deleted",
]);
const WORKFLOW_ACTIONS = new Set(["requested", "in_progress", "completed"]);
const REPOSITORY_ACTIONS = new Set([
  "renamed",
  "edited",
  "archived",
  "unarchived",
  "transferred",
]);
const INSTALLATION_ACTIONS = new Set([
  "created",
  "new_permissions_accepted",
  "suspend",
  "unsuspend",
  "deleted",
]);
const INSTALLATION_REPOSITORY_ACTIONS = new Set(["added", "removed"]);

export function parseMinimalWebhookEnvelope(
  event: string,
  value: unknown,
): MinimalWebhookEnvelope {
  const payload = record(value);
  const repository = optionalRecord(payload.repository);
  const installation = optionalRecord(payload.installation);
  const account = optionalRecord(installation?.account);
  const action = optionalString(payload.action, 64);
  const pullRequest = optionalRecord(payload.pull_request);
  const issue = optionalRecord(payload.issue);
  const release = optionalRecord(payload.release);
  const workflowRun = optionalRecord(payload.workflow_run);

  return {
    event,
    action,
    installationId: optionalPositiveBigInt(installation?.id),
    repositoryId: optionalPositiveBigInt(repository?.id),
    repositoryOwner: optionalString(
      optionalRecord(repository?.owner)?.login,
      100,
    ),
    repositoryName: optionalString(repository?.name, 100),
    ref: optionalString(payload.ref, 300),
    deleted: typeof payload.deleted === "boolean" ? payload.deleted : null,
    forced: typeof payload.forced === "boolean" ? payload.forced : null,
    sourceGithubId:
      optionalIntegerString(pullRequest?.id) ??
      optionalIntegerString(issue?.id) ??
      optionalIntegerString(release?.id) ??
      optionalIntegerString(workflowRun?.id),
    installationAccountId: optionalPositiveBigInt(account?.id),
    addedRepositoryIds: repositoryIds(payload.repositories_added),
    removedRepositoryIds: repositoryIds(payload.repositories_removed),
    issueHasPullRequestMarker:
      event === "issues" && optionalRecord(issue?.pull_request) !== null,
  };
}

export function routeWebhookEnvelope(
  envelope: MinimalWebhookEnvelope,
  context: {
    trackedRepository: boolean;
    defaultBranch: string | null;
    verifiedInstallation: boolean;
  },
): WebhookRoutingDecision {
  const basePayload = {
    action: envelope.action,
    sourceGithubId: envelope.sourceGithubId,
  };

  if (envelope.event === "ping")
    return { type: "ignored", reason: "PING_ACKNOWLEDGED" };
  if (
    !SUPPORTED_WEBHOOK_EVENTS.includes(envelope.event as SupportedWebhookEvent)
  )
    return { type: "ignored", reason: "UNSUPPORTED_EVENT" };

  if (envelope.event === "installation") {
    if (
      !envelope.action ||
      !INSTALLATION_ACTIONS.has(envelope.action) ||
      !context.verifiedInstallation
    )
      return {
        type: "ignored",
        reason: context.verifiedInstallation
          ? "UNSUPPORTED_ACTION"
          : "INSTALLATION_MISMATCH",
      };
    return {
      type: "job",
      job: {
        kind: "INSTALLATION_STATE",
        payload: {
          ...basePayload,
          accountId: envelope.installationAccountId?.toString() ?? null,
        },
      },
    };
  }

  if (envelope.event === "installation_repositories") {
    if (
      !envelope.action ||
      !INSTALLATION_REPOSITORY_ACTIONS.has(envelope.action) ||
      !context.verifiedInstallation
    )
      return {
        type: "ignored",
        reason: context.verifiedInstallation
          ? "UNSUPPORTED_ACTION"
          : "INSTALLATION_MISMATCH",
      };
    return {
      type: "job",
      job: {
        kind: "INSTALLATION_REPOSITORIES",
        payload: {
          ...basePayload,
          addedRepositoryIds: envelope.addedRepositoryIds,
          removedRepositoryIds: envelope.removedRepositoryIds,
        },
      },
    };
  }

  if (!context.verifiedInstallation)
    return { type: "ignored", reason: "INSTALLATION_MISMATCH" };
  if (!context.trackedRepository)
    return { type: "ignored", reason: "UNTRACKED_REPOSITORY" };

  if (envelope.event === "push") {
    if (
      !context.defaultBranch ||
      envelope.ref !== `refs/heads/${context.defaultBranch}`
    )
      return { type: "ignored", reason: "NON_DEFAULT_BRANCH" };
    return {
      type: "job",
      job: {
        kind: "COMMITS",
        payload: {
          ...basePayload,
          ref: envelope.ref,
          deleted: envelope.deleted,
          forced: envelope.forced,
        },
      },
    };
  }

  if (envelope.event === "issues" && envelope.issueHasPullRequestMarker)
    return { type: "ignored", reason: "ISSUE_IS_PULL_REQUEST" };

  const mappings = [
    ["pull_request", PR_ACTIONS, "PULL_REQUESTS"],
    ["issues", ISSUE_ACTIONS, "ISSUES"],
    ["release", RELEASE_ACTIONS, "RELEASES"],
    ["workflow_run", WORKFLOW_ACTIONS, "WORKFLOW_RUNS"],
    ["repository", REPOSITORY_ACTIONS, "REPOSITORY_METADATA"],
  ] as const;
  const mapping = mappings.find(([event]) => event === envelope.event);
  if (!mapping) return { type: "ignored", reason: "UNSUPPORTED_EVENT" };
  if (!envelope.action || !mapping[1].has(envelope.action))
    return { type: "ignored", reason: "UNSUPPORTED_ACTION" };
  return {
    type: "job",
    job: {
      kind: mapping[2],
      payload: {
        ...basePayload,
        repositoryOwner: envelope.repositoryOwner,
        repositoryName: envelope.repositoryName,
      },
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("WEBHOOK_INVALID_ENVELOPE");
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : null;
}

function optionalPositiveBigInt(value: unknown): bigint | null {
  const text = optionalIntegerString(value);
  if (!text) return null;
  const result = BigInt(text);
  return result > BigInt(0) ? result : null;
}

function optionalIntegerString(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return String(value);
  if (typeof value === "string" && /^\d{1,20}$/.test(value)) return value;
  return null;
}

function repositoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 500)
    .map((item) => optionalIntegerString(optionalRecord(item)?.id))
    .filter((item): item is string => item !== null);
}
