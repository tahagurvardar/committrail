import { getAuth } from "@/lib/auth/auth";
import { ensurePersonalWorkspace } from "@/lib/auth/workspace";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  const workspace = await ensurePersonalWorkspace(session.user);
  const prisma = getPrisma();
  const owned = await prisma.workspace.findUnique({
    where: { id: workspace.id },
    include: {
      installations: true,
      trackedRepositories: {
        include: {
          snapshot: true,
          evidence: { include: { observations: true } },
          syncRuns: true,
          ingestionJobs: true,
          webhookDeliveries: true,
        },
      },
      evidenceClaims: {
        include: { evidenceLinks: true, revisions: true },
      },
      auditEvents: true,
    },
  });
  await prisma.auditEvent.create({
    data: {
      workspaceId: workspace.id,
      userId: session.user.id,
      type: "account.export.requested",
    },
  });
  const exportData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    account: { id: session.user.id, email: session.user.email },
    workspace: owned && {
      id: owned.id,
      name: owned.name,
      createdAt: owned.createdAt,
      installations: owned.installations.map(
        ({
          installationId,
          accountId,
          accountLogin,
          accountType,
          repositorySelection,
          permissions,
          verifiedAt,
          lastRepositoryDiscoveryAt,
        }) => ({
          installationId: installationId.toString(),
          accountId: accountId.toString(),
          accountLogin,
          accountType,
          repositorySelection,
          permissions,
          verifiedAt,
          lastRepositoryDiscoveryAt,
        }),
      ),
      trackedRepositories: owned.trackedRepositories.map((repository) => ({
        id: repository.id,
        githubRepositoryId: repository.githubRepositoryId.toString(),
        fullName: repository.fullName,
        visibility: repository.visibility,
        snapshot: repository.snapshot?.normalizedData ?? null,
        evidence: repository.evidence.map(
          ({
            evidenceId,
            evidenceType,
            githubSourceId,
            canonicalUrl,
            occurredAt,
            title,
            sourceLabel,
            confidence,
            factualPayload,
            normalizedContentHash,
            sourceAvailability,
            sourceUnavailableAt,
            firstSeenAt,
            lastSeenAt,
            observations,
          }) => ({
            evidenceId,
            evidenceType,
            githubSourceId,
            canonicalUrl,
            occurredAt,
            title,
            sourceLabel,
            confidence,
            factualPayload,
            normalizedContentHash,
            sourceAvailability,
            sourceUnavailableAt,
            firstSeenAt,
            lastSeenAt,
            observations: observations.map(
              ({
                sourceKind,
                syncRunId,
                webhookDeliveryId,
                observedAt,
                normalizedContentHash: observationHash,
                createdAt,
              }) => ({
                sourceKind,
                syncRunId,
                webhookDeliveryId,
                observedAt,
                normalizedContentHash: observationHash,
                createdAt,
              }),
            ),
          }),
        ),
        syncRuns: repository.syncRuns.map(
          ({
            mode,
            status,
            startedAt,
            completedAt,
            sanitizedErrorCode,
            insertedCount,
            updatedCount,
            seenCount,
            sectionAvailability,
          }) => ({
            mode,
            status,
            startedAt,
            completedAt,
            sanitizedErrorCode,
            insertedCount,
            updatedCount,
            seenCount,
            sectionAvailability,
          }),
        ),
        webhookDeliveries: repository.webhookDeliveries.map(
          ({
            githubDeliveryId,
            eventName,
            action,
            payloadSha256,
            bodyByteCount,
            duplicateCount,
            receivedAt,
            status,
            ignoredReason,
            processedAt,
            sanitizedErrorCode,
          }) => ({
            githubDeliveryId,
            eventName,
            action,
            payloadSha256,
            bodyByteCount,
            duplicateCount,
            receivedAt,
            status,
            ignoredReason,
            processedAt,
            sanitizedErrorCode,
          }),
        ),
        ingestionJobs: repository.ingestionJobs.map(
          ({
            id,
            kind,
            status,
            availableAt,
            attemptCount,
            maximumAttempts,
            startedAt,
            completedAt,
            sanitizedLastErrorCode,
            createdAt,
          }) => ({
            id,
            kind,
            status,
            availableAt,
            attemptCount,
            maximumAttempts,
            startedAt,
            completedAt,
            sanitizedLastErrorCode,
            createdAt,
          }),
        ),
      })),
      claims: owned.evidenceClaims.map(
        ({
          id,
          trackedRepositoryId,
          statement,
          status,
          verifiedAt,
          version,
          createdAt,
          updatedAt,
          evidenceLinks,
          revisions,
        }) => ({
          id,
          trackedRepositoryId,
          statement,
          status,
          verifiedAt,
          version,
          createdAt,
          updatedAt,
          evidenceLinks: evidenceLinks.map(
            ({ repositoryEvidenceId, createdAt: linkedAt }) => ({
              repositoryEvidenceId,
              linkedAt,
            }),
          ),
          revisions: revisions.map(
            ({
              revisionNumber,
              kind,
              statementSnapshot,
              status: revisionStatus,
              evidenceIdSnapshot,
              changeSummary,
              createdAt: revisedAt,
            }) => ({
              revisionNumber,
              kind,
              statementSnapshot,
              status: revisionStatus,
              evidenceIdSnapshot,
              changeSummary,
              revisedAt,
            }),
          ),
        }),
      ),
      auditEvents: owned.auditEvents.map(({ type, metadata, createdAt }) => ({
        type,
        metadata,
        createdAt,
      })),
    },
  };
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="committrail-export.json"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
