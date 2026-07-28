import "server-only";

import type {
  ActivitySourceKind,
  ActivityEvidence,
} from "@/lib/github/activity-types";
import type { IngestionJobKind, Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { createInstallationToken } from "@/lib/github-app/client";
import { GitHubRestPublicRepositoryActivityProvider } from "@/lib/github/github-rest-public-repository-activity-provider";
import { GitHubRestPublicRepositoryProvider } from "@/lib/github/github-rest-public-repository-provider";
import { markPublicationEvidenceUnavailable } from "@/lib/publishing/health-service";
import { persistEvidenceRecords } from "@/lib/repositories/evidence-persistence";

const SOURCE_FOR_JOB: Partial<Record<IngestionJobKind, ActivitySourceKind>> = {
  COMMITS: "commits",
  PULL_REQUESTS: "pullRequests",
  ISSUES: "issues",
  RELEASES: "releases",
  WORKFLOW_RUNS: "workflowRuns",
};

export async function reconcileRepositorySource(input: {
  jobId: string;
  generation: number;
  kind: IngestionJobKind;
  trackedRepositoryId: string;
  minimalPayload: Prisma.JsonValue;
}) {
  const prisma = getPrisma();
  const repository = await prisma.trackedRepository.findUnique({
    where: { id: input.trackedRepositoryId },
    include: { installation: true },
  });
  if (
    !repository ||
    repository.trackingStatus !== "ACTIVE" ||
    !repository.installation
  )
    throw new Error("REPOSITORY_NOT_ACCESSIBLE");
  if (repository.installation.suspendedAt)
    throw new Error("INSTALLATION_SUSPENDED");

  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      ingestionJobId: input.jobId,
      jobGeneration: { lte: input.generation },
    },
    select: { id: true },
  });
  const token = await createInstallationToken(
    repository.installation.installationId,
    repository.githubRepositoryId,
  );
  const identifier = { owner: repository.ownerLogin, repo: repository.name };

  if (input.kind === "REPOSITORY_METADATA") {
    const snapshot = await new GitHubRestPublicRepositoryProvider({
      token,
      allowPrivate: true,
    }).getRepositorySnapshot(identifier);
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
      await tx.trackedRepository.update({
        where: { id: repository.id },
        data: {
          ownerLogin: snapshot.identity.owner,
          name: snapshot.identity.name,
          fullName: snapshot.identity.fullName,
          defaultBranch: snapshot.defaultBranch,
          visibility: snapshot.isPrivate ? "private" : "public",
          archived: snapshot.archived,
          lastSuccessfulSyncAt: new Date(),
        },
      });
      await updateCursor(tx, repository.id, input.kind);
    });
    return { seen: 0 };
  }

  const source = SOURCE_FOR_JOB[input.kind];
  if (!source) throw new Error("UNSUPPORTED_RECONCILIATION_KIND");
  const section = await new GitHubRestPublicRepositoryActivityProvider({
    token,
  }).getRepositoryActivitySource(
    identifier,
    {
      defaultBranch: repository.defaultBranch,
    },
    source,
  );
  if (section.status === "unavailable") {
    const error = new Error(
      section.reason === "rate-limited"
        ? "GITHUB_RATE_LIMITED"
        : "GITHUB_SOURCE_UNAVAILABLE",
    );
    if (section.retryAt)
      Object.assign(error, { rateLimitResetAt: section.retryAt });
    throw error;
  }
  const records = section.items as ActivityEvidence[];
  const payload = asRecord(input.minimalPayload);
  await prisma.$transaction(async (tx) => {
    await persistEvidenceRecords({
      tx,
      trackedRepositoryId: repository.id,
      records,
      source: {
        kind: "WEBHOOK",
        webhookDeliveryIds: deliveries.map((delivery) => delivery.id),
      },
    });
    if (
      input.kind === "RELEASES" &&
      payload.action === "deleted" &&
      typeof payload.sourceGithubId === "string"
    ) {
      const unavailableEvidence = await tx.repositoryEvidence.findMany({
        where: {
          trackedRepositoryId: repository.id,
          evidenceType: "release",
          githubSourceId: payload.sourceGithubId,
        },
        select: { id: true },
      });
      const unavailableAt = new Date();
      await tx.repositoryEvidence.updateMany({
        where: {
          id: { in: unavailableEvidence.map((evidence) => evidence.id) },
        },
        data: {
          sourceAvailability: "DELETED",
          sourceUnavailableAt: unavailableAt,
        },
      });
      await markPublicationEvidenceUnavailable(
        tx,
        unavailableEvidence.map((evidence) => evidence.id),
        unavailableAt,
      );
    }
    await tx.trackedRepository.update({
      where: { id: repository.id },
      data: { lastSuccessfulSyncAt: new Date(), latestSyncStatus: "SUCCEEDED" },
    });
    await updateCursor(tx, repository.id, input.kind);
  });
  return { seen: records.length };
}

async function updateCursor(
  tx: Prisma.TransactionClient,
  trackedRepositoryId: string,
  sourceKind: IngestionJobKind,
) {
  await tx.repositoryIngestionCursor.upsert({
    where: {
      trackedRepositoryId_sourceKind: { trackedRepositoryId, sourceKind },
    },
    create: {
      trackedRepositoryId,
      sourceKind,
      lastSuccessfulAt: new Date(),
    },
    update: { lastSuccessfulAt: new Date() },
  });
}

function asRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
