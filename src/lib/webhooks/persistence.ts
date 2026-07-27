import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import {
  parseMinimalWebhookEnvelope,
  routeWebhookEnvelope,
} from "@/lib/webhooks/envelope";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function persistVerifiedWebhook(input: {
  githubDeliveryId: string;
  event: string;
  bodyByteCount: number;
  payloadSha256: string;
  parsedBody: unknown;
}): Promise<{ duplicate: boolean; ignored: boolean; deliveryId: string }> {
  const envelope = parseMinimalWebhookEnvelope(input.event, input.parsedBody);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.githubDeliveryId}))`;
    const duplicate = await tx.webhookDelivery.findUnique({
      where: { githubDeliveryId: input.githubDeliveryId },
      select: { id: true, status: true },
    });
    if (duplicate) {
      await tx.webhookDelivery.update({
        where: { id: duplicate.id },
        data: { duplicateCount: { increment: 1 } },
      });
      return {
        duplicate: true,
        ignored: duplicate.status === "IGNORED",
        deliveryId: duplicate.id,
      };
    }

    const installation = envelope.installationId
      ? await tx.gitHubInstallation.findUnique({
          where: { installationId: envelope.installationId },
        })
      : null;
    const repository =
      installation && envelope.repositoryId
        ? await tx.trackedRepository.findFirst({
            where: {
              githubInstallationId: installation.id,
              workspaceId: installation.workspaceId,
              githubRepositoryId: envelope.repositoryId,
            },
          })
        : null;
    const decision = routeWebhookEnvelope(envelope, {
      verifiedInstallation: installation !== null,
      trackedRepository: repository !== null,
      defaultBranch: repository?.defaultBranch ?? null,
    });
    const delivery = await tx.webhookDelivery.create({
      data: {
        githubDeliveryId: input.githubDeliveryId,
        workspaceId: installation?.workspaceId,
        githubInstallationId: installation?.id,
        trackedRepositoryId: repository?.id,
        eventName: input.event,
        action: envelope.action,
        installationId: envelope.installationId,
        githubRepositoryId: envelope.repositoryId,
        payloadSha256: input.payloadSha256,
        bodyByteCount: input.bodyByteCount,
        status: decision.type === "ignored" ? "IGNORED" : "RECEIVED",
        ignoredReason:
          decision.type === "ignored" ? decision.reason : undefined,
        processedAt: decision.type === "ignored" ? new Date() : undefined,
      },
    });

    if (decision.type === "ignored")
      return { duplicate: false, ignored: true, deliveryId: delivery.id };
    if (!installation) throw new Error("WEBHOOK_INSTALLATION_NOT_RESOLVED");

    const repositoryKey = repository?.id ?? installation.id;
    const deduplicationKey = `${repositoryKey}:${decision.job.kind}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${deduplicationKey}))`;
    let job = await tx.ingestionJob.findFirst({
      where: {
        deduplicationKey,
        status: { in: ["PENDING", "RUNNING"] },
      },
      orderBy: { createdAt: "asc" },
    });
    let jobGeneration = 0;
    if (!job) {
      job = await tx.ingestionJob.create({
        data: {
          workspaceId: installation.workspaceId,
          trackedRepositoryId: repository?.id,
          githubInstallationId: installation.id,
          kind: decision.job.kind,
          deduplicationKey,
          minimalPayload: json(decision.job.payload),
        },
      });
    } else {
      jobGeneration =
        job.status === "RUNNING" ? job.generation + 1 : job.generation;
      job = await tx.ingestionJob.update({
        where: { id: job.id },
        data: {
          minimalPayload: json(decision.job.payload),
          availableAt: new Date(),
          ...(job.status === "RUNNING" ? { generation: { increment: 1 } } : {}),
        },
      });
    }
    await tx.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "QUEUED",
        ingestionJobId: job.id,
        jobGeneration,
      },
    });
    return { duplicate: false, ignored: false, deliveryId: delivery.id };
  });
}
