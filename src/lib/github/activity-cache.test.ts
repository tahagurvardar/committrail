import { describe, expect, it, vi } from "vitest";

import {
  ACTIVITY_CACHE_KEY,
  ACTIVITY_REVALIDATE_SECONDS,
} from "@/lib/github/activity-cache-config";
import {
  createPublicRepositoryActivityLoader,
  type ActivityCacheAdapter,
} from "@/lib/github/activity-cache";
import type { PublicRepositoryActivity } from "@/lib/github/activity-types";

function activity(partial = false): PublicRepositoryActivity {
  const available = {
    status: "available" as const,
    items: [],
    pagination: { hasMore: false, returnedCount: 0, sampleLimit: 20 },
    discardedRecordCount: 0,
  };
  return {
    repository: { owner: "acme", repo: "rocket" },
    fetchedAt: "2026-07-27T12:00:00.000Z",
    categoryUrls: {
      commits: "https://github.com/acme/rocket/commits/main",
      pullRequests: "https://github.com/acme/rocket/pulls",
      issues: "https://github.com/acme/rocket/issues",
      releases: "https://github.com/acme/rocket/releases",
      workflowRuns: "https://github.com/acme/rocket/actions",
    },
    commits: partial
      ? {
          status: "unavailable",
          reason: "rate-limited",
          retryAt: null,
        }
      : available,
    pullRequests: available,
    issues: available,
    releases: {
      ...available,
      pagination: { ...available.pagination, sampleLimit: 10 },
    },
    workflowRuns: available,
  };
}

function memoryCache(): ActivityCacheAdapter {
  const values = new Map<string, PublicRepositoryActivity>();
  return (callback) => async (owner, repo, defaultBranch) => {
    const key = `${owner}/${repo}/${defaultBranch}`;
    const existing = values.get(key);
    if (existing) return existing;
    const result = await callback(owner, repo, defaultBranch);
    values.set(key, result);
    return result;
  };
}

describe("public activity cache boundary", () => {
  it("normalizes identity, keeps token out of keys, and uses five-minute freshness", async () => {
    const provider = {
      getRepositoryActivity: vi.fn().mockResolvedValue(activity()),
    };
    let keyParts: string[] = [];
    let revalidate = 0;
    const adapter: ActivityCacheAdapter = (callback, keys, options) => {
      keyParts = keys;
      revalidate = options.revalidate;
      return callback;
    };
    const load = createPublicRepositoryActivityLoader(() => provider, adapter);

    await load({ owner: "AcMe", repo: "RoCkEt" }, { defaultBranch: "main" });
    expect(provider.getRepositoryActivity).toHaveBeenCalledWith(
      { owner: "acme", repo: "rocket" },
      { defaultBranch: "main" },
    );
    expect(keyParts).toEqual([ACTIVITY_CACHE_KEY]);
    expect(revalidate).toBe(ACTIVITY_REVALIDATE_SECONDS);
    expect(revalidate).toBe(300);
    expect(JSON.stringify(keyParts)).not.toMatch(/token|secret|bearer/i);
  });

  it("serves a cache hit without duplicate activity requests", async () => {
    const provider = {
      getRepositoryActivity: vi.fn().mockResolvedValue(activity()),
    };
    const load = createPublicRepositoryActivityLoader(
      () => provider,
      memoryCache(),
    );
    const input = { owner: "acme", repo: "rocket" };
    await load(input, { defaultBranch: "main" });
    await load(input, { defaultBranch: "main" });
    expect(provider.getRepositoryActivity).toHaveBeenCalledTimes(1);
  });

  it("returns but does not cache partial transient failures as success", async () => {
    const provider = {
      getRepositoryActivity: vi.fn().mockResolvedValue(activity(true)),
    };
    const load = createPublicRepositoryActivityLoader(
      () => provider,
      memoryCache(),
    );
    const input = { owner: "acme", repo: "rocket" };
    expect((await load(input, { defaultBranch: "main" })).commits.status).toBe(
      "unavailable",
    );
    await load(input, { defaultBranch: "main" });
    expect(provider.getRepositoryActivity).toHaveBeenCalledTimes(2);
  });

  it("does not convert provider rejection into available empty data", async () => {
    const failure = new Error("configuration failed");
    const provider = {
      getRepositoryActivity: vi.fn().mockRejectedValue(failure),
    };
    const load = createPublicRepositoryActivityLoader(
      () => provider,
      memoryCache(),
    );
    await expect(
      load({ owner: "acme", repo: "rocket" }, { defaultBranch: "main" }),
    ).rejects.toBe(failure);
  });
});
