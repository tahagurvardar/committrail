import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { hasCurrentExternalConsent } from "@/lib/drafting/consent-service";
import { buildEvidenceBundleFromRecords } from "@/lib/drafting/evidence-bundle";
import { DraftingError } from "@/lib/drafting/errors";
import { validateGroundedDraftOutput } from "@/lib/drafting/output-validation";
import { getGroundedDraftProvider } from "@/lib/drafting/provider-registry";
import type { GroundedDraftProvider } from "@/lib/drafting/types";

export async function processDraftGenerationJob(
  jobId: string,
  provider: GroundedDraftProvider = getGroundedDraftProvider(),
) {
  const prisma = getPrisma();
  const request = await prisma.draftGenerationRequest.findFirst({
    where: { ingestionJobId: jobId },
    include: {
      candidate: { select: { id: true } },
      evidenceSelections: {
        orderBy: { position: "asc" },
        include: { repositoryEvidence: true },
      },
    },
  });
  if (!request) throw new DraftingError("DRAFT_REQUEST_NOT_FOUND");
  if (request.candidate) {
    await prisma.draftGenerationRequest.update({
      where: { id: request.id },
      data: {
        status: "SUCCEEDED",
        completedAt: request.completedAt ?? new Date(),
        sanitizedErrorCode: null,
      },
    });
    return request.candidate;
  }
  if (
    !provider.descriptor.configured ||
    provider.descriptor.kind !== request.providerKind ||
    provider.descriptor.classification !== request.providerClassification ||
    provider.descriptor.providerIdentityHash !== request.providerIdentityHash
  )
    throw new DraftingError(
      provider.descriptor.configured
        ? "DRAFT_PROVIDER_CHANGED"
        : "DRAFT_PROVIDER_DISABLED",
    );
  if (
    !(await hasCurrentExternalConsent(request.workspaceId, provider.descriptor))
  )
    throw new DraftingError("DRAFT_EXTERNAL_CONSENT_REQUIRED");

  const built = currentBundle(request.evidenceSelections, provider);
  assertRequestEvidenceMatches(request, built);
  const startedAt = new Date();
  await prisma.$transaction([
    prisma.draftGenerationRequest.update({
      where: { id: request.id },
      data: {
        status: "RUNNING",
        startedAt: request.startedAt ?? startedAt,
        sanitizedErrorCode: null,
      },
    }),
    prisma.draftReviewEvent.create({
      data: {
        workspaceId: request.workspaceId,
        draftRequestId: request.id,
        kind: "GENERATION_STARTED",
      },
    }),
  ]);

  const providerStartedAt = Date.now();
  const response = await provider.generate(
    {
      intent: request.draftingIntent,
      style: request.style,
      evidenceBundle: built.bundle,
    },
    { requestId: request.id },
  );
  const validated = validateGroundedDraftOutput(
    response.content,
    built.bundle,
    provider.descriptor.maximumOutputBytes,
  );
  const durationMs = Math.min(Date.now() - providerStartedAt, 2_147_483_647);

  return prisma.$transaction(
    async (tx) => {
      const fresh = await tx.draftGenerationRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: {
          candidate: { select: { id: true } },
          evidenceSelections: {
            orderBy: { position: "asc" },
            include: { repositoryEvidence: true },
          },
        },
      });
      if (fresh.candidate) return fresh.candidate;
      const freshBundle = currentBundle(fresh.evidenceSelections, provider);
      assertRequestEvidenceMatches(fresh, freshBundle);
      const candidate = await tx.draftCandidate.create({
        data: {
          requestId: fresh.id,
          title: validated.output.title,
          combinedStatement: validated.combinedStatement,
          caveats: json(validated.output.caveats),
          policyWarnings: json(validated.policyWarnings),
          sentenceCount: validated.coverage.sentenceCount,
          citedSentenceCount: validated.coverage.citedSentenceCount,
          uniqueEvidenceCount: validated.coverage.uniqueEvidenceCount,
          selectedEvidenceCount: validated.coverage.selectedEvidenceCount,
          evidenceTypesUsed: json(validated.coverage.evidenceTypesUsed),
          unusedSelectedEvidenceCount:
            validated.coverage.unusedSelectedEvidenceCount,
          sentences: {
            create: validated.output.sentences.map((sentence, position) => ({
              position,
              text: sentence.text,
              citations: {
                create: sentence.evidenceIds.map(
                  (repositoryEvidenceId, citationPosition) => ({
                    repositoryEvidenceId,
                    trackedRepositoryId: fresh.trackedRepositoryId,
                    position: citationPosition,
                  }),
                ),
              },
            })),
          },
        },
      });
      const completedAt = new Date();
      await tx.draftGenerationRequest.update({
        where: { id: fresh.id },
        data: {
          status: "SUCCEEDED",
          completedAt,
          sanitizedErrorCode: null,
          outputByteCount: response.byteSize,
          requestDurationMs: durationMs,
          inputTokenCount: response.usage?.inputTokens,
          outputTokenCount: response.usage?.outputTokens,
        },
      });
      await tx.draftReviewEvent.create({
        data: {
          workspaceId: fresh.workspaceId,
          draftRequestId: fresh.id,
          candidateId: candidate.id,
          kind: "GENERATION_SUCCEEDED",
          metadata: {
            sentenceCount: validated.coverage.sentenceCount,
            uniqueEvidenceCount: validated.coverage.uniqueEvidenceCount,
            unusedSelectedEvidenceCount:
              validated.coverage.unusedSelectedEvidenceCount,
          },
        },
      });
      return candidate;
    },
    { isolationLevel: "Serializable" },
  );
}

function currentBundle(
  selections: Array<{
    evidenceContentHash: string;
    repositoryEvidence: {
      id: string;
      evidenceId: string;
      evidenceType: string;
      occurredAt: Date;
      title: string;
      canonicalUrl: string;
      confidence: string;
      normalizedContentHash: string;
      sourceAvailability: "AVAILABLE" | "UNAVAILABLE" | "DELETED";
      factualPayload: Prisma.JsonValue;
    };
  }>,
  provider: GroundedDraftProvider,
) {
  if (
    selections.some(
      (selection) =>
        selection.repositoryEvidence.sourceAvailability !== "AVAILABLE" ||
        selection.repositoryEvidence.normalizedContentHash !==
          selection.evidenceContentHash,
    )
  )
    throw new DraftingError("DRAFT_EVIDENCE_CHANGED");
  return buildEvidenceBundleFromRecords(
    selections.map((selection) => selection.repositoryEvidence),
    provider.descriptor.maximumRequestBytes,
  );
}

function assertRequestEvidenceMatches(
  request: {
    evidenceBundleHash: string;
    evidenceBundleVersion: number;
    inputEvidenceCount: number;
    inputByteCount: number;
  },
  built: {
    hash: string;
    byteSize: number;
    bundle: { schemaVersion: number; evidence: unknown[] };
  },
) {
  if (
    request.evidenceBundleHash !== built.hash ||
    request.evidenceBundleVersion !== built.bundle.schemaVersion ||
    request.inputEvidenceCount !== built.bundle.evidence.length ||
    request.inputByteCount !== built.byteSize
  )
    throw new DraftingError("DRAFT_EVIDENCE_CHANGED");
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
