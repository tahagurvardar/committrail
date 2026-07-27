import {
  GitHubRestClient,
  type GitHubRestClientOptions,
  repositoryApiPath,
} from "@/lib/github/github-rest-client";
import {
  mapRepositorySnapshot,
  readRateLimit,
} from "@/lib/github/map-github-response";
import type { PublicRepositoryProvider } from "@/lib/github/public-repository-provider";
import type {
  PublicRepositorySnapshot,
  RepositoryIdentifier,
} from "@/lib/github/types";

export type GitHubProviderOptions = GitHubRestClientOptions & {
  allowPrivate?: boolean;
};

/**
 * Read-only Phase 1A snapshot provider.
 *
 * The shared REST client owns the fixed API origin, GET-only transport,
 * headers, timeouts, bounded error parsing, and typed failures.
 */
export class GitHubRestPublicRepositoryProvider implements PublicRepositoryProvider {
  private readonly client: GitHubRestClient;
  private readonly now: () => Date;
  private readonly allowPrivate: boolean;

  constructor(options: GitHubProviderOptions = {}) {
    this.client = new GitHubRestClient(options);
    this.now = options.now ?? (() => new Date());
    this.allowPrivate = options.allowPrivate ?? false;
  }

  async getRepositorySnapshot(
    repository: RepositoryIdentifier,
  ): Promise<PublicRepositorySnapshot> {
    const repoPath = repositoryApiPath(repository);
    const metadataResponse = await this.client.getJson(repoPath);
    const rateLimit = readRateLimit(metadataResponse.headers);

    // Exactly two bounded follow-ups; the full uncached snapshot costs three.
    const [languagesResponse, readmeResponse] = await Promise.all([
      this.client.getJson(repositoryApiPath(repository, "/languages")),
      this.client.getJson(repositoryApiPath(repository, "/readme"), undefined, {
        allowNotFound: true,
      }),
    ]);

    return mapRepositorySnapshot({
      metadata: metadataResponse.body,
      languages: languagesResponse.body,
      readme: readmeResponse.body,
      fetchedAt: this.now().toISOString(),
      rateLimit,
      allowPrivate: this.allowPrivate,
    });
  }
}
