import "server-only";

import { randomUUID } from "node:crypto";
import type {
  IngestionJob,
  IngestionJobStatus,
  Prisma,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { isDraftingError } from "@/lib/drafting/errors";
import { processDraftGenerationJob } from "@/lib/drafting/worker-handler";
import type { GroundedDraftProvider } from "@/lib/drafting/types";
import { isProviderError } from "@/lib/github/errors";
import { prepareRepositoryPublicationRemoval } from "@/lib/publishing/health-service";
import { reconcileRepositorySource } from "@/lib/repositories/reconcile";

export const INGESTION_BATCH_SIZE = 10;
export const INGESTION_CONCURRENCY = 2;
export const INGESTION_LEASE_MS = 2 * 60 * 1000;
export const INGESTION_POLL_MS = 2_000;

export async function claimIngestionJobs(input?: {
  workerId?: string;
  batchSize?: number;
  now?: Date;
}): Promise<IngestionJob[]> {
  const prisma = getPrisma();
  const workerId = input?.workerId ?? randomUUID();
  const batchSize = Math.min(
    Math.max(input?.batchSize ?? INGESTION_BATCH_SIZE, 1),
    INGESTION_BATCH_SIZE,
  );
  const now = input?.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + INGESTION_LEASE_MS);
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH candidates AS (
      SELECT "id"
      FROM "IngestionJob"
      WHERE (
        ("status" = 'PENDING'::"IngestionJobStatus" AND "availableAt" <= ${now})
        OR
        ("status" = 'RUNNING'::"IngestionJobStatus" AND "leaseExpiresAt" < ${now})
      )
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE "IngestionJob" AS job
    SET
      "status" = 'RUNNING'::"IngestionJobStatus",
      "attemptCount" = job."attemptCount" + 1,
      "leaseOwner" = ${workerId},
      "leaseExpiresAt" = ${leaseExpiresAt},
      "startedAt" = COALESCE(job."startedAt", ${now}),
      "updatedAt" = ${now}
    FROM candidates
    WHERE job."id" = candidates."id"
    RETURNING job."id"
  `;
  if (!claimed.length) return [];
  return prisma.ingestionJob.findMany({
    where: { id: { in: claimed.map((item) => item.id) } },
    orderBy: { createdAt: "asc" },
  });
}

export async function processIngestionJob(
  job: IngestionJob,
  options?: { draftProvider?: GroundedDraftProvider },
): Promise<void> {
  try {
    if (job.kind === "GROUNDED_DRAFT") {
      await processDraftGenerationJob(job.id, options?.draftProvider);
    } else if (job.trackedRepositoryId) {
      await reconcileRepositorySource({
        jobId: job.id,
        generation: job.generation,
        kind: job.kind,
        trackedRepositoryId: job.trackedRepositoryId,
        minimalPayload: job.minimalPayload,
      });
    } else {
      await processInstallationJob(job);
    }
    await finishJob(job, "SUCCEEDED");
  } catch (error) {
    await failJob(job, error);
  }
}

export async function runIngestionWorkerOnce(input?: {
  workerId?: string;
  batchSize?: number;
}): Promise<{ claimed: number }> {
  const jobs = await claimIngestionJobs(input);
  for (let index = 0; index < jobs.length; index += INGESTION_CONCURRENCY) {
    await Promise.allSettled(
      jobs
        .slice(index, index + INGESTION_CONCURRENCY)
        .map((job) => processIngestionJob(job)),
    );
  }
  return { claimed: jobs.length };
}

export function ingestionBackoffMs(attemptCount: number): number {
  const safeAttempt = Math.min(Math.max(attemptCount, 1), 10);
  return Math.min(30_000 * 2 ** (safeAttempt - 1), 30 * 60 * 1000);
}

export function classifyIngestionError(error: unknown): {
  code: string;
  retryable: boolean;
  retryAt: Date | null;
} {
  if (isDraftingError(error))
    return {
      code: error.code,
      retryable: error.retryable,
      retryAt: error.retryAt,
    };
  const providerCode = isProviderError(error)
    ? {
        "invalid-input": "GITHUB_INVALID_INPUT",
        "not-found": "GITHUB_NOT_FOUND",
        "auth-config": "GITHUB_AUTHORIZATION_FAILED",
        "rate-limited": "GITHUB_RATE_LIMITED",
        "upstream-unavailable": "GITHUB_SOURCE_UNAVAILABLE",
        timeout: "GITHUB_TIMEOUT",
        "malformed-response": "GITHUB_MALFORMED_RESPONSE",
        unexpected: "GITHUB_UNEXPECTED_RESPONSE",
      }[error.code]
    : null;
  const raw =
    providerCode ??
    (error instanceof Error && /^[A-Z0-9_-]{3,64}$/.test(error.message)
      ? error.message
      : "INGESTION_FAILURE");
  const permanent = new Set([
    "REPOSITORY_NOT_ACCESSIBLE",
    "INSTALLATION_SUSPENDED",
    "UNSUPPORTED_RECONCILIATION_KIND",
    "GITHUB_APP_INVALID_INPUT",
    "GITHUB_APP_AUTH_FAILED",
    "GITHUB_INVALID_INPUT",
    "GITHUB_NOT_FOUND",
    "GITHUB_AUTHORIZATION_FAILED",
  ]);
  const retryAt = retryDateFrom(error);
  return { code: raw, retryable: !permanent.has(raw), retryAt };
}

async function finishJob(
  job: IngestionJob,
  status: Extract<IngestionJobStatus, "SUCCEEDED">,
) {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const current = await tx.ingestionJob.findUniqueOrThrow({
      where: { id: job.id },
      select: { generation: true },
    });
    const followUpRequired = current.generation > job.generation;
    await tx.ingestionJob.update({
      where: { id: job.id },
      data: followUpRequired
        ? {
            status: "PENDING",
            availableAt: new Date(),
            completedAt: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            sanitizedLastErrorCode: null,
          }
        : {
            status,
            completedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
            sanitizedLastErrorCode: null,
          },
    });
    await tx.webhookDelivery.updateMany({
      where: {
        ingestionJobId: job.id,
        jobGeneration: { lte: job.generation },
      },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  });
}

async function failJob(job: IngestionJob, error: unknown) {
  const prisma = getPrisma();
  const failure = classifyIngestionError(error);
  const exhausted = job.attemptCount >= job.maximumAttempts;
  const status: IngestionJobStatus = !failure.retryable
    ? "FAILED"
    : exhausted
      ? "DEAD"
      : "PENDING";
  const availableAt =
    failure.retryAt ??
    new Date(Date.now() + ingestionBackoffMs(job.attemptCount));
  await prisma.$transaction(async (tx) => {
    await tx.ingestionJob.update({
      where: { id: job.id },
      data: {
        status,
        availableAt,
        completedAt: status === "PENDING" ? null : new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        sanitizedLastErrorCode: failure.code,
      },
    });
    await tx.webhookDelivery.updateMany({
      where: {
        ingestionJobId: job.id,
        jobGeneration: { lte: job.generation },
      },
      data:
        status === "PENDING"
          ? { status: "QUEUED", sanitizedErrorCode: failure.code }
          : {
              status: "FAILED",
              processedAt: new Date(),
              sanitizedErrorCode: failure.code,
            },
    });
    if (job.kind === "GROUNDED_DRAFT") {
      const request = await tx.draftGenerationRequest.findFirst({
        where: { ingestionJobId: job.id },
        select: { id: true, workspaceId: true },
      });
      if (request) {
        await tx.draftGenerationRequest.update({
          where: { id: request.id },
          data: {
            status: status === "PENDING" ? "QUEUED" : "FAILED",
            completedAt: status === "PENDING" ? null : new Date(),
            sanitizedErrorCode: failure.code,
          },
        });
        if (status !== "PENDING") {
          await tx.draftReviewEvent.create({
            data: {
              workspaceId: request.workspaceId,
              draftRequestId: request.id,
              kind: "GENERATION_FAILED",
              metadata: { errorCode: failure.code },
            },
          });
        }
      }
    }
  });
}

async function processInstallationJob(job: IngestionJob) {
  if (!job.githubInstallationId) throw new Error("INSTALLATION_NOT_RESOLVED");
  const prisma = getPrisma();
  const payload = asRecord(job.minimalPayload);
  const action = typeof payload.action === "string" ? payload.action : "";
  const installation = await prisma.gitHubInstallation.findFirst({
    where: {
      id: job.githubInstallationId,
      workspaceId: job.workspaceId,
    },
  });
  if (!installation) throw new Error("INSTALLATION_NOT_RESOLVED");

  if (job.kind === "INSTALLATION_STATE") {
    if (action === "suspend") {
      await prisma.$transaction([
        prisma.gitHubInstallation.update({
          where: { id: installation.id },
          data: { suspendedAt: new Date() },
        }),
        prisma.ingestionJob.updateMany({
          where: {
            githubInstallationId: installation.id,
            id: { not: job.id },
            status: "PENDING",
          },
          data: { status: "CANCELLED", completedAt: new Date() },
        }),
      ]);
      return;
    }
    if (action === "unsuspend") {
      const repositories = await prisma.trackedRepository.findMany({
        where: {
          githubInstallationId: installation.id,
          trackingStatus: "ACTIVE",
        },
        select: { id: true },
      });
      const kinds = [
        "REPOSITORY_METADATA",
        "COMMITS",
        "PULL_REQUESTS",
        "ISSUES",
        "RELEASES",
        "WORKFLOW_RUNS",
      ] as const;
      await prisma.$transaction(async (tx) => {
        await tx.gitHubInstallation.update({
          where: { id: installation.id },
          data: { suspendedAt: null, verifiedAt: new Date() },
        });
        await tx.ingestionJob.createMany({
          data: repositories.flatMap((repository) =>
            kinds.map((kind) => ({
              workspaceId: installation.workspaceId,
              trackedRepositoryId: repository.id,
              githubInstallationId: installation.id,
              kind,
              deduplicationKey: `${repository.id}:${kind}`,
              minimalPayload: { action: "unsuspend_reconciliation" },
            })),
          ),
          skipDuplicates: true,
        });
      });
      return;
    }
    if (action === "deleted") {
      await prisma.$transaction(async (tx) => {
        const repositories = await tx.trackedRepository.findMany({
          where: { githubInstallationId: installation.id },
          select: { id: true },
        });
        const repositoryIds = repositories.map((repository) => repository.id);
        await prepareRepositoryPublicationRemoval(
          tx,
          { workspaceId: installation.workspaceId },
          repositoryIds,
        );
        await tx.projectPublication.updateMany({
          where: { trackedRepositoryId: { in: repositoryIds } },
          data: { currentPublishedRevisionId: null },
        });
        await tx.projectPublication.deleteMany({
          where: { trackedRepositoryId: { in: repositoryIds } },
        });
        await tx.portfolioOutput.updateMany({
          where: { trackedRepositoryId: { in: repositoryIds } },
          data: { currentRevisionId: null },
        });
        await tx.portfolioOutput.deleteMany({
          where: { trackedRepositoryId: { in: repositoryIds } },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId: installation.workspaceId,
            type: "github.installation.deleted",
          },
        });
        await tx.gitHubInstallation.delete({ where: { id: installation.id } });
      });
      return;
    }
    if (action === "created" || action === "new_permissions_accepted") {
      await prisma.gitHubInstallation.update({
        where: { id: installation.id },
        data: { verifiedAt: new Date() },
      });
      return;
    }
    throw new Error("UNSUPPORTED_INSTALLATION_ACTION");
  }

  if (job.kind === "INSTALLATION_REPOSITORIES") {
    const removedIds = stringArray(payload.removedRepositoryIds).map(BigInt);
    if (action === "removed" && removedIds.length) {
      const repositories = await prisma.trackedRepository.findMany({
        where: {
          githubInstallationId: installation.id,
          githubRepositoryId: { in: removedIds },
        },
        select: { id: true },
      });
      await prisma.$transaction(async (tx) => {
        const repositoryIds = repositories.map((repository) => repository.id);
        await prepareRepositoryPublicationRemoval(
          tx,
          { workspaceId: installation.workspaceId },
          repositoryIds,
        );
        await tx.trackedRepository.updateMany({
          where: { id: { in: repositories.map((item) => item.id) } },
          data: { trackingStatus: "INACCESSIBLE" },
        });
        await tx.ingestionJob.updateMany({
          where: {
            trackedRepositoryId: {
              in: repositories.map((item) => item.id),
            },
            id: { not: job.id },
            status: "PENDING",
          },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
      });
      return;
    }
    if (action === "added") {
      await prisma.gitHubInstallation.update({
        where: { id: installation.id },
        data: { lastRepositoryDiscoveryAt: new Date() },
      });
      return;
    }
    throw new Error("UNSUPPORTED_INSTALLATION_REPOSITORIES_ACTION");
  }
  throw new Error("UNSUPPORTED_INSTALLATION_JOB");
}

function asRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function stringArray(value: Prisma.JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function retryDateFrom(error: unknown): Date | null {
  if (!error || typeof error !== "object") return null;
  const value = error as {
    rateLimitResetAt?: string | null;
    retryAfterSeconds?: number | null;
  };
  if (value.rateLimitResetAt) {
    const timestamp = Date.parse(value.rateLimitResetAt);
    if (Number.isFinite(timestamp) && timestamp > Date.now())
      return new Date(timestamp);
  }
  if (
    typeof value.retryAfterSeconds === "number" &&
    value.retryAfterSeconds > 0
  )
    return new Date(Date.now() + value.retryAfterSeconds * 1000);
  return null;
}
