import { unstable_cache } from "next/cache";

import {
  SNAPSHOT_REVALIDATE_SECONDS,
  SNAPSHOT_CACHE_KEY,
} from "@/lib/github/snapshot-cache-config";
import { getPublicRepositoryProvider } from "@/lib/github/service";
import type { PublicRepositoryProvider } from "@/lib/github/public-repository-provider";
import type {
  PublicRepositorySnapshot,
  RepositoryIdentifier,
} from "@/lib/github/types";

type SnapshotCallback = (
  owner: string,
  repo: string,
) => Promise<PublicRepositorySnapshot>;

export type SnapshotCacheAdapter = (
  callback: SnapshotCallback,
  keyParts: string[],
  options: { revalidate: number },
) => SnapshotCallback;

/**
 * Builds the success-only public snapshot cache boundary.
 *
 * Next's cache stores the callback result only after the promise resolves, so
 * typed provider failures remain failures rather than cached snapshot values.
 * The token is read inside the provider factory and never enters arguments or
 * key parts.
 */
export function createPublicRepositorySnapshotLoader(
  providerFactory: () => PublicRepositoryProvider = getPublicRepositoryProvider,
  cacheAdapter: SnapshotCacheAdapter = unstable_cache,
): (repository: RepositoryIdentifier) => Promise<PublicRepositorySnapshot> {
  const loadCached = cacheAdapter(
    async (owner, repo) =>
      providerFactory().getRepositorySnapshot({ owner, repo }),
    [SNAPSHOT_CACHE_KEY],
    { revalidate: SNAPSHOT_REVALIDATE_SECONDS },
  );

  return (repository) =>
    loadCached(repository.owner.toLowerCase(), repository.repo.toLowerCase());
}

export const getPublicRepositorySnapshot =
  createPublicRepositorySnapshotLoader();
