import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RepositoryActivity } from "@/components/repository/repository-activity";
import { RepositorySnapshot } from "@/components/repository/repository-snapshot";
import {
  SnapshotErrorState,
  type SnapshotErrorDetails,
} from "@/components/repository/snapshot-error-state";
import { isProviderError } from "@/lib/github/errors";
import { getPublicRepositoryActivity } from "@/lib/github/activity-cache";
import type { PublicRepositoryActivity } from "@/lib/github/activity-types";
import { validateRepositoryIdentifier } from "@/lib/github/parse-repository-input";
import { getPublicRepositorySnapshot } from "@/lib/github/snapshot-cache";
import type { PublicRepositorySnapshot } from "@/lib/github/types";

/**
 * Keep route/error rendering dynamic. Only a successfully normalized snapshot
 * is cached by the data boundary; provider failures and notFound() are not.
 */
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ owner: string; repo: string }>;
}

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { owner, repo } = await params;
  const identifier = validateRepositoryIdentifier(owner, repo);
  if (!identifier) {
    return { title: "Repository snapshot" };
  }
  return {
    title: `${identifier.owner}/${identifier.repo} — public evidence`,
    description: `Read-only public snapshot and bounded recent activity evidence for ${identifier.owner}/${identifier.repo}, fetched from the GitHub REST API.`,
  };
}

export default async function RepositorySnapshotPage({ params }: RouteProps) {
  const { owner, repo } = await params;
  const identifier = validateRepositoryIdentifier(owner, repo);
  if (!identifier) {
    notFound();
  }

  let snapshot: PublicRepositorySnapshot | null = null;
  let failure: SnapshotErrorDetails | null = null;

  try {
    snapshot = await getPublicRepositorySnapshot(identifier);
  } catch (error) {
    if (!isProviderError(error)) {
      throw error;
    }
    if (error.code === "not-found" || error.code === "invalid-input") {
      notFound();
    }
    failure = {
      code: error.code,
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
      rateLimitResetAt: error.rateLimitResetAt,
    };
  }

  if (failure !== null) {
    return (
      <div className="container-page py-16 sm:py-24">
        <SnapshotErrorState
          owner={identifier.owner}
          repo={identifier.repo}
          error={failure}
        />
      </div>
    );
  }
  if (snapshot === null) {
    notFound();
  }

  let activity: PublicRepositoryActivity;
  try {
    activity = await getPublicRepositoryActivity(identifier, {
      defaultBranch: snapshot.defaultBranch,
    });
  } catch (error) {
    // Token configuration is a site-wide operator problem. Other unexpected
    // failures still use the route error boundary; endpoint-local failures are
    // normalized by the activity provider and do not hide the snapshot.
    if (isProviderError(error) && error.code === "not-found") {
      notFound();
    }
    throw error;
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <RepositorySnapshot snapshot={snapshot} />
      <RepositoryActivity activity={activity} />
    </div>
  );
}
