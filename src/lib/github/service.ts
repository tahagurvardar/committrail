import { GitHubRestPublicRepositoryProvider } from "@/lib/github/github-rest-public-repository-provider";
import { GitHubRestPublicRepositoryActivityProvider } from "@/lib/github/github-rest-public-repository-activity-provider";
import type { PublicRepositoryActivityProvider } from "@/lib/github/public-repository-activity-provider";
import type { PublicRepositoryProvider } from "@/lib/github/public-repository-provider";

/**
 * Server-only composition point for the public repository provider.
 *
 * The optional GITHUB_TOKEN is read from server environment only — it is
 * never required, never sent to the client, and never stored. This module
 * must only be imported from Server Components and server code.
 */
export function getPublicRepositoryProvider(): PublicRepositoryProvider {
  return new GitHubRestPublicRepositoryProvider({
    token: process.env.GITHUB_TOKEN,
  });
}

export function getPublicRepositoryActivityProvider(): PublicRepositoryActivityProvider {
  return new GitHubRestPublicRepositoryActivityProvider({
    token: process.env.GITHUB_TOKEN,
  });
}
