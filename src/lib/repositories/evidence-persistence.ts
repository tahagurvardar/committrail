import "server-only";

import { createHash } from "node:crypto";
import type {
  ActivityEvidence,
  EvidenceType,
} from "@/lib/github/activity-types";
import type { Prisma } from "@/generated/prisma/client";

export function normalizedContentHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export async function persistEvidenceRecords(input: {
  tx: Prisma.TransactionClient;
  trackedRepositoryId: string;
  records: ActivityEvidence[];
  source:
    | { kind: "MANUAL_SYNC"; syncRunId: string }
    | { kind: "WEBHOOK"; webhookDeliveryIds: string[] };
  observedAt?: Date;
}): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const observedAt = input.observedAt ?? new Date();
  for (const record of input.records) {
    const hash = normalizedContentHash(record);
    const existing = await input.tx.repositoryEvidence.findUnique({
      where: {
        trackedRepositoryId_evidenceId: {
          trackedRepositoryId: input.trackedRepositoryId,
          evidenceId: record.evidenceId,
        },
      },
      select: { id: true, normalizedContentHash: true },
    });
    const evidence = await input.tx.repositoryEvidence.upsert({
      where: {
        trackedRepositoryId_evidenceId: {
          trackedRepositoryId: input.trackedRepositoryId,
          evidenceId: record.evidenceId,
        },
      },
      create: {
        trackedRepositoryId: input.trackedRepositoryId,
        evidenceId: record.evidenceId,
        evidenceType: record.evidenceType,
        githubSourceId: record.sourceIdentifier,
        canonicalUrl: record.sourceUrl,
        occurredAt: new Date(record.occurredAt),
        title: record.title,
        factualPayload: json(record),
        normalizedContentHash: hash,
      },
      update: {
        githubSourceId: record.sourceIdentifier,
        canonicalUrl: record.sourceUrl,
        occurredAt: new Date(record.occurredAt),
        title: record.title,
        factualPayload: json(record),
        normalizedContentHash: hash,
        sourceAvailability: "AVAILABLE",
        sourceUnavailableAt: null,
        lastSeenAt: observedAt,
      },
      select: { id: true },
    });
    if (existing) updated += 1;
    else inserted += 1;
    if (existing && existing.normalizedContentHash !== hash) {
      const affected = await input.tx.projectPublication.findMany({
        where: {
          status: "PUBLISHED",
          healthState: "CURRENT",
          currentPublishedRevision: {
            evidenceSnapshots: {
              some: {
                sourceRepositoryEvidenceId: evidence.id,
                sourceContentHash: { not: hash },
              },
            },
          },
        },
        select: { id: true, workspaceId: true },
      });
      if (affected.length) {
        await input.tx.projectPublication.updateMany({
          where: { id: { in: affected.map((publication) => publication.id) } },
          data: {
            healthState: "REVIEW_REQUIRED",
            healthCheckedAt: observedAt,
            version: { increment: 1 },
          },
        });
        await input.tx.publicationEvent.createMany({
          data: affected.map((publication) => ({
            workspaceId: publication.workspaceId,
            publicationId: publication.id,
            kind: "EVIDENCE_BECAME_STALE",
            safeMetadata: { health: "REVIEW_REQUIRED" },
          })),
        });
      }
    }

    if (input.source.kind === "MANUAL_SYNC") {
      await input.tx.evidenceObservation.upsert({
        where: {
          deduplicationKey: `${evidence.id}:manual:${input.source.syncRunId}`,
        },
        create: {
          repositoryEvidenceId: evidence.id,
          sourceKind: "MANUAL_SYNC",
          syncRunId: input.source.syncRunId,
          observedAt,
          normalizedContentHash: hash,
          deduplicationKey: `${evidence.id}:manual:${input.source.syncRunId}`,
        },
        update: {},
      });
    } else {
      for (const deliveryId of input.source.webhookDeliveryIds) {
        await input.tx.evidenceObservation.upsert({
          where: {
            deduplicationKey: `${evidence.id}:webhook:${deliveryId}`,
          },
          create: {
            repositoryEvidenceId: evidence.id,
            sourceKind: "WEBHOOK",
            webhookDeliveryId: deliveryId,
            observedAt,
            normalizedContentHash: hash,
            deduplicationKey: `${evidence.id}:webhook:${deliveryId}`,
          },
          update: {},
        });
      }
    }
  }
  return { inserted, updated };
}

export function evidenceTypeForJob(kind: string): EvidenceType | null {
  const values: Record<string, EvidenceType> = {
    COMMITS: "commit",
    PULL_REQUESTS: "pull-request",
    ISSUES: "issue",
    RELEASES: "release",
    WORKFLOW_RUNS: "workflow-run",
  };
  return values[kind] ?? null;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
