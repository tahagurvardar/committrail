import { describe, expect, it, vi } from "vitest";

import { PublicRepositoryProviderError } from "@/lib/github/errors";
import {
  SNAPSHOT_CACHE_KEY,
  SNAPSHOT_REVALIDATE_SECONDS,
} from "@/lib/github/snapshot-cache-config";
import {
  createPublicRepositorySnapshotLoader,
  type SnapshotCacheAdapter,
} from "@/lib/github/snapshot-cache";
import type { PublicRepositorySnapshot } from "@/lib/github/types";

const SNAPSHOT = {
  identity: {
    owner: "Acme",
    name: "Rocket",
    fullName: "Acme/Rocket",
    url: "https://github.com/Acme/Rocket",
  },
} as PublicRepositorySnapshot;

describe("public repository snapshot cache boundary", () => {
  it("uses normalized identity, a static secret-free key, and five-minute freshness", async () => {
    const provider = {
      getRepositorySnapshot: vi.fn().mockResolvedValue(SNAPSHOT),
    };
    let observedKeyParts: string[] = [];
    let observedRevalidate = 0;
    const cacheAdapter: SnapshotCacheAdapter = (
      callback,
      keyParts,
      options,
    ) => {
      observedKeyParts = keyParts;
      observedRevalidate = options.revalidate;
      return callback;
    };

    const load = createPublicRepositorySnapshotLoader(
      () => provider,
      cacheAdapter,
    );
    await load({ owner: "AcMe", repo: "RoCkEt" });

    expect(provider.getRepositorySnapshot).toHaveBeenCalledWith({
      owner: "acme",
      repo: "rocket",
    });
    expect(observedKeyParts).toEqual([SNAPSHOT_CACHE_KEY]);
    expect(observedRevalidate).toBe(SNAPSHOT_REVALIDATE_SECONDS);
    expect(JSON.stringify(observedKeyParts)).not.toMatch(
      /token|secret|bearer/i,
    );
    expect(SNAPSHOT_REVALIDATE_SECONDS).toBe(300);
  });

  it("preserves typed failures instead of creating a fallback snapshot", async () => {
    const failure = new PublicRepositoryProviderError(
      "rate-limited",
      "GitHub temporarily rate-limited requests from this site.",
    );
    const provider = {
      getRepositorySnapshot: vi.fn().mockRejectedValue(failure),
    };
    const passthrough: SnapshotCacheAdapter = (callback) => callback;
    const load = createPublicRepositorySnapshotLoader(
      () => provider,
      passthrough,
    );

    await expect(load({ owner: "acme", repo: "rocket" })).rejects.toBe(failure);
  });
});
