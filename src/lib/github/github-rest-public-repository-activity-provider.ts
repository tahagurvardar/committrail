import {
  ACTIVITY_LIMITS,
  type ActivitySection,
  type PublicRepositoryActivity,
  type RepositoryActivityContext,
} from "@/lib/github/activity-types";
import { PublicRepositoryProviderError } from "@/lib/github/errors";
import {
  GitHubRestClient,
  type GitHubRestClientOptions,
  repositoryApiPath,
} from "@/lib/github/github-rest-client";
import {
  mapCommitResponse,
  mapIssueResponse,
  mapPullRequestResponse,
  mapReleaseResponse,
  mapWorkflowRunResponse,
} from "@/lib/github/map-github-activity-response";
import { activityPagination } from "@/lib/github/pagination";
import type { PublicRepositoryActivityProvider } from "@/lib/github/public-repository-activity-provider";
import { safePublicText } from "@/lib/github/safe-public-text";
import type { RepositoryIdentifier } from "@/lib/github/types";

type Mapped<T> = {
  items: T[];
  discardedRecordCount: number;
};

type ActivityTask<T> = () => Promise<ActivitySection<T>>;

export type GitHubActivityProviderOptions = GitHubRestClientOptions;

export class GitHubRestPublicRepositoryActivityProvider implements PublicRepositoryActivityProvider {
  private readonly client: GitHubRestClient;
  private readonly now: () => Date;

  constructor(options: GitHubActivityProviderOptions = {}) {
    this.client = new GitHubRestClient(options);
    this.now = options.now ?? (() => new Date());
  }

  async getRepositoryActivity(
    repository: RepositoryIdentifier,
    context: RepositoryActivityContext,
  ): Promise<PublicRepositoryActivity> {
    const defaultBranch = safePublicText(context.defaultBranch, 150);
    if (defaultBranch === null || defaultBranch !== context.defaultBranch) {
      throw new PublicRepositoryProviderError(
        "malformed-response",
        "GitHub returned an invalid default branch.",
      );
    }

    const tasks = [
      () =>
        this.loadSection(
          repositoryApiPath(repository, "/commits"),
          {
            sha: defaultBranch,
            per_page: String(ACTIVITY_LIMITS.commits),
            page: "1",
          },
          ACTIVITY_LIMITS.commits,
          (raw) => mapCommitResponse(raw, repository),
        ),
      () =>
        this.loadSection(
          repositoryApiPath(repository, "/pulls"),
          {
            state: "all",
            sort: "updated",
            direction: "desc",
            per_page: String(ACTIVITY_LIMITS.pullRequests),
            page: "1",
          },
          ACTIVITY_LIMITS.pullRequests,
          (raw) => mapPullRequestResponse(raw, repository),
        ),
      () =>
        this.loadSection(
          repositoryApiPath(repository, "/issues"),
          {
            state: "all",
            sort: "updated",
            direction: "desc",
            per_page: String(ACTIVITY_LIMITS.issues),
            page: "1",
          },
          ACTIVITY_LIMITS.issues,
          (raw) => mapIssueResponse(raw, repository),
        ),
      () =>
        this.loadSection(
          repositoryApiPath(repository, "/releases"),
          {
            per_page: String(ACTIVITY_LIMITS.releases),
            page: "1",
          },
          ACTIVITY_LIMITS.releases,
          (raw) => mapReleaseResponse(raw, repository),
        ),
      () =>
        this.loadSection(
          repositoryApiPath(repository, "/actions/runs"),
          {
            per_page: String(ACTIVITY_LIMITS.workflowRuns),
            page: "1",
          },
          ACTIVITY_LIMITS.workflowRuns,
          (raw) => mapWorkflowRunResponse(raw, repository),
        ),
    ] as const;

    const [commits, pullRequests, issues, releases, workflowRuns] =
      await runWithConcurrency(tasks, 2);

    const webBase = `https://github.com/${encodeURIComponent(
      repository.owner,
    )}/${encodeURIComponent(repository.repo)}`;
    return {
      repository: {
        owner: repository.owner,
        repo: repository.repo,
      },
      fetchedAt: this.now().toISOString(),
      categoryUrls: {
        commits: `${webBase}/commits/${encodeURIComponent(defaultBranch)}`,
        pullRequests: `${webBase}/pulls`,
        issues: `${webBase}/issues`,
        releases: `${webBase}/releases`,
        workflowRuns: `${webBase}/actions`,
      },
      commits,
      pullRequests,
      issues,
      releases,
      workflowRuns,
    };
  }

  private async loadSection<T>(
    path: string,
    searchParams: Readonly<Record<string, string>>,
    sampleLimit: number,
    mapper: (raw: unknown) => Mapped<T>,
  ): Promise<ActivitySection<T>> {
    try {
      const response = await this.client.getJson(path, searchParams);
      const mapped = mapper(response.body);
      return {
        status: "available",
        items: mapped.items.slice(0, sampleLimit),
        pagination: activityPagination(
          response.headers,
          Math.min(mapped.items.length, sampleLimit),
          sampleLimit,
        ),
        discardedRecordCount: mapped.discardedRecordCount,
      };
    } catch (error) {
      if (!(error instanceof PublicRepositoryProviderError)) {
        throw error;
      }
      if (error.code === "auth-config" || error.code === "invalid-input") {
        throw error;
      }
      const reason =
        error.code === "rate-limited" ||
        error.code === "upstream-unavailable" ||
        error.code === "timeout" ||
        error.code === "malformed-response"
          ? error.code
          : error.code === "not-found"
            ? "not-supported"
            : "upstream-unavailable";
      return {
        status: "unavailable",
        reason,
        retryAt: retryAtFor(error, this.now()),
      };
    }
  }
}

async function runWithConcurrency<T extends readonly ActivityTask<unknown>[]>(
  tasks: T,
  concurrency: number,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results: unknown[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () =>
      worker(),
    ),
  );
  return results as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

function retryAtFor(
  error: PublicRepositoryProviderError,
  now: Date,
): string | null {
  if (error.rateLimitResetAt !== null) {
    return error.rateLimitResetAt;
  }
  if (error.retryAfterSeconds !== null) {
    return new Date(
      now.getTime() + error.retryAfterSeconds * 1_000,
    ).toISOString();
  }
  return null;
}
