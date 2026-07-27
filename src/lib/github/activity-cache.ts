import { unstable_cache } from "next/cache";

import {
  ACTIVITY_CACHE_KEY,
  ACTIVITY_REVALIDATE_SECONDS,
} from "@/lib/github/activity-cache-config";
import type {
  PublicRepositoryActivity,
  RepositoryActivityContext,
} from "@/lib/github/activity-types";
import type { PublicRepositoryActivityProvider } from "@/lib/github/public-repository-activity-provider";
import { getPublicRepositoryActivityProvider } from "@/lib/github/service";
import type { RepositoryIdentifier } from "@/lib/github/types";

type ActivityCallback = (
  owner: string,
  repo: string,
  defaultBranch: string,
) => Promise<PublicRepositoryActivity>;

export type ActivityCacheAdapter = (
  callback: ActivityCallback,
  keyParts: string[],
  options: { revalidate: number },
) => ActivityCallback;

class PartialActivityCacheBypass extends Error {
  readonly activity: PublicRepositoryActivity;

  constructor(activity: PublicRepositoryActivity) {
    super("Partial activity is intentionally not cached.");
    this.name = "PartialActivityCacheBypass";
    this.activity = activity;
  }
}

/**
 * Caches only fully available, successfully normalized activity for five
 * minutes. A partial result is returned to the page but deliberately rejects
 * inside the cache callback, so transient failures are never frozen.
 */
export function createPublicRepositoryActivityLoader(
  providerFactory: () => PublicRepositoryActivityProvider = getPublicRepositoryActivityProvider,
  cacheAdapter: ActivityCacheAdapter = unstable_cache,
): (
  repository: RepositoryIdentifier,
  context: RepositoryActivityContext,
) => Promise<PublicRepositoryActivity> {
  const loadCached = cacheAdapter(
    async (owner, repo, defaultBranch) => {
      const activity = await providerFactory().getRepositoryActivity(
        { owner, repo },
        { defaultBranch },
      );
      if (hasUnavailableSection(activity)) {
        throw new PartialActivityCacheBypass(activity);
      }
      return activity;
    },
    [ACTIVITY_CACHE_KEY],
    { revalidate: ACTIVITY_REVALIDATE_SECONDS },
  );

  return async (repository, context) => {
    try {
      return await loadCached(
        repository.owner.toLowerCase(),
        repository.repo.toLowerCase(),
        context.defaultBranch,
      );
    } catch (error) {
      if (error instanceof PartialActivityCacheBypass) {
        return error.activity;
      }
      throw error;
    }
  };
}

export function hasUnavailableSection(
  activity: PublicRepositoryActivity,
): boolean {
  return (
    activity.commits.status === "unavailable" ||
    activity.pullRequests.status === "unavailable" ||
    activity.issues.status === "unavailable" ||
    activity.releases.status === "unavailable" ||
    activity.workflowRuns.status === "unavailable"
  );
}

export const getPublicRepositoryActivity =
  createPublicRepositoryActivityLoader();
