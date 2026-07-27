import type {
  PublicRepositorySnapshot,
  RepositoryIdentifier,
} from "@/lib/github/types";

/**
 * Narrow server-side boundary for public repository data.
 *
 * UI code never talks to GitHub; it consumes PublicRepositorySnapshot values
 * produced behind this interface. Tests substitute deterministic fixtures,
 * and Phase 2 can add a persistence-backed implementation without touching
 * routes or components.
 */
export interface PublicRepositoryProvider {
  getRepositorySnapshot(
    repository: RepositoryIdentifier,
  ): Promise<PublicRepositorySnapshot>;
}
