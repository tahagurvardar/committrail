import type {
  PublicRepositoryActivity,
  RepositoryActivityContext,
} from "@/lib/github/activity-types";
import type { RepositoryIdentifier } from "@/lib/github/types";

/** Narrow server-only boundary for bounded public activity evidence. */
export interface PublicRepositoryActivityProvider {
  getRepositoryActivity(
    repository: RepositoryIdentifier,
    context: RepositoryActivityContext,
  ): Promise<PublicRepositoryActivity>;
}
