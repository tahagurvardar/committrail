import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { createInstallationToken } from "@/lib/github-app/client";
import { GitHubRestPublicRepositoryActivityProvider } from "@/lib/github/github-rest-public-repository-activity-provider";
import { GitHubRestPublicRepositoryProvider } from "@/lib/github/github-rest-public-repository-provider";
import type {
  ActivityEvidence,
  PublicRepositoryActivity,
} from "@/lib/github/activity-types";
import { getPrisma } from "@/lib/db/prisma";
import { persistEvidenceRecords } from "@/lib/repositories/evidence-persistence";

const STALE_AFTER_MS = 15 * 60 * 1000;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function evidenceFrom(activity: PublicRepositoryActivity): ActivityEvidence[] {
  const records: ActivityEvidence[] = [];
  if (activity.commits.status === "available")
    records.push(...activity.commits.items);
  if (activity.pullRequests.status === "available")
    records.push(...activity.pullRequests.items);
  if (activity.issues.status === "available")
    records.push(...activity.issues.items);
  if (activity.releases.status === "available")
    records.push(...activity.releases.items);
  if (activity.workflowRuns.status === "available")
    records.push(...activity.workflowRuns.items);
  return records;
}

function availability(activity: PublicRepositoryActivity) {
  return {
    commits: activity.commits.status,
    pullRequests: activity.pullRequests.status,
    issues: activity.issues.status,
    releases: activity.releases.status,
    workflowRuns: activity.workflowRuns.status,
  };
}

export async function synchronizeTrackedRepository(input: {
  trackedRepositoryId: string;
  userId: string;
  workspaceId: string;
  mode: "INITIAL" | "MANUAL";
}) {
  const prisma = getPrisma();
  const repository = await prisma.trackedRepository.findFirst({
    where: {
      id: input.trackedRepositoryId,
      workspaceId: input.workspaceId,
      trackingStatus: "ACTIVE",
    },
    include: { installation: true },
  });
  if (!repository || !repository.installation)
    throw new Error("SYNC_NOT_AUTHORIZED");

  const run = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${repository.id}))`;
    await tx.repositorySyncRun.updateMany({
      where: {
        trackedRepositoryId: repository.id,
        status: "RUNNING",
        startedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        sanitizedErrorCode: "STALE_RUN",
      },
    });
    const active = await tx.repositorySyncRun.findFirst({
      where: { trackedRepositoryId: repository.id, status: "RUNNING" },
    });
    if (active) throw new Error("SYNC_ALREADY_RUNNING");
    return tx.repositorySyncRun.create({
      data: {
        trackedRepositoryId: repository.id,
        initiatingUserId: input.userId,
        mode: input.mode,
        status: "RUNNING",
      },
    });
  });

  try {
    const token = await createInstallationToken(
      repository.installation.installationId,
      repository.githubRepositoryId,
    );
    const identifier = { owner: repository.ownerLogin, repo: repository.name };
    const snapshotProvider = new GitHubRestPublicRepositoryProvider({
      token,
      allowPrivate: true,
    });
    const snapshot = await snapshotProvider.getRepositorySnapshot(identifier);
    const activityProvider = new GitHubRestPublicRepositoryActivityProvider({
      token,
    });
    const activity = await activityProvider.getRepositoryActivity(identifier, {
      defaultBranch: snapshot.defaultBranch,
    });
    const records = evidenceFrom(activity);
    const partial = Object.values(availability(activity)).some(
      (status) => status === "unavailable",
    );
    let inserted = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      await tx.repositorySnapshot.upsert({
        where: { trackedRepositoryId: repository.id },
        create: {
          trackedRepositoryId: repository.id,
          normalizedData: json(snapshot),
          sourceUpdatedAt: new Date(snapshot.updatedAt),
          sourcePushedAt: snapshot.pushedAt
            ? new Date(snapshot.pushedAt)
            : null,
          fetchedAt: new Date(snapshot.fetchedAt),
        },
        update: {
          normalizedData: json(snapshot),
          sourceUpdatedAt: new Date(snapshot.updatedAt),
          sourcePushedAt: snapshot.pushedAt
            ? new Date(snapshot.pushedAt)
            : null,
          fetchedAt: new Date(snapshot.fetchedAt),
        },
      });
      const persisted = await persistEvidenceRecords({
        tx,
        trackedRepositoryId: repository.id,
        records,
        source: { kind: "MANUAL_SYNC", syncRunId: run.id },
      });
      inserted = persisted.inserted;
      updated = persisted.updated;
      const status = partial ? "PARTIAL" : "SUCCEEDED";
      await tx.repositorySyncRun.update({
        where: { id: run.id },
        data: {
          status,
          completedAt: new Date(),
          insertedCount: inserted,
          updatedCount: updated,
          seenCount: records.length,
          sectionAvailability: json(availability(activity)),
        },
      });
      await tx.trackedRepository.update({
        where: { id: repository.id },
        data: {
          latestSyncStatus: status,
          ...(partial ? {} : { lastSuccessfulSyncAt: new Date() }),
          defaultBranch: snapshot.defaultBranch,
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          type: "repository.sync.completed",
          metadata: { trackedRepositoryId: repository.id, status },
        },
      });
    });
    return {
      status: partial ? "PARTIAL" : "SUCCEEDED",
      inserted,
      updated,
      seen: records.length,
    };
  } catch (error) {
    const code =
      error instanceof Error && /^[A-Z0-9_]{3,64}$/.test(error.message)
        ? error.message
        : "SYNC_UPSTREAM_FAILURE";
    await prisma.$transaction([
      prisma.repositorySyncRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          sanitizedErrorCode: code,
        },
      }),
      prisma.trackedRepository.update({
        where: { id: repository.id },
        data: { latestSyncStatus: "FAILED" },
      }),
    ]);
    throw new Error(code);
  }
}
