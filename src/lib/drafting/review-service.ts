import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { DraftingError } from "@/lib/drafting/errors";
import { validExpectedVersion } from "@/lib/claims/validation";

interface ReviewAuthority {
  workspaceId: string;
  userId: string;
}

export async function rejectDraftCandidate(input: {
  candidateId: string;
  trackedRepositoryId: string;
  reason?: unknown;
}) {
  const authority = await currentAuthority();
  const reason = optionalRejectionReason(input.reason);
  return getPrisma().$transaction(async (tx) => {
    const candidate = await scopedCandidate(
      tx,
      authority,
      input.candidateId,
      input.trackedRepositoryId,
    );
    if (!candidate) throw new DraftingError("DRAFT_CANDIDATE_NOT_FOUND");
    if (candidate.reviewStatus === "REJECTED") return candidate;
    if (candidate.reviewStatus !== "READY")
      throw new DraftingError("DRAFT_CANDIDATE_NOT_REVIEWABLE");
    const updated = await tx.draftCandidate.update({
      where: { id: candidate.id },
      data: {
        reviewStatus: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason,
        reviewedByUserId: authority.userId,
      },
    });
    await tx.draftReviewEvent.create({
      data: {
        workspaceId: authority.workspaceId,
        draftRequestId: candidate.requestId,
        candidateId: candidate.id,
        actorUserId: authority.userId,
        kind: "CANDIDATE_REJECTED",
        metadata: { reasonProvided: Boolean(reason) },
      },
    });
    return updated;
  });
}

export async function acceptDraftCandidateAsNewClaim(
  candidateId: string,
  trackedRepositoryId: string,
) {
  const authority = await currentAuthority();
  return acceptCandidate(authority, candidateId, trackedRepositoryId, null);
}

export async function acceptDraftCandidateIntoClaim(input: {
  candidateId: string;
  trackedRepositoryId: string;
  claimId: string;
  expectedVersion: unknown;
}) {
  const authority = await currentAuthority();
  return acceptCandidate(
    authority,
    input.candidateId,
    input.trackedRepositoryId,
    {
      claimId: input.claimId,
      expectedVersion: validExpectedVersion(input.expectedVersion),
    },
  );
}

export async function refreshDraftGroundingStatus(input: {
  draftRequestId: string;
  trackedRepositoryId: string;
}) {
  const authority = await currentAuthority();
  const request = await getPrisma().draftGenerationRequest.findFirst({
    where: {
      id: input.draftRequestId,
      workspaceId: authority.workspaceId,
      trackedRepositoryId: input.trackedRepositoryId,
    },
    include: {
      candidate: true,
      evidenceSelections: { include: { repositoryEvidence: true } },
    },
  });
  if (!request) throw new DraftingError("DRAFT_REQUEST_NOT_FOUND");
  if (!request.candidate) return null;
  const stale = request.evidenceSelections.some(
    (selection) =>
      selection.repositoryEvidence.sourceAvailability !== "AVAILABLE" ||
      selection.repositoryEvidence.normalizedContentHash !==
        selection.evidenceContentHash,
  );
  if (stale && request.candidate.groundingStatus !== "STALE")
    return getPrisma().draftCandidate.update({
      where: { id: request.candidate.id },
      data: { groundingStatus: "STALE" },
    });
  return request.candidate;
}

async function acceptCandidate(
  authority: ReviewAuthority,
  candidateId: string,
  trackedRepositoryId: string,
  target: { claimId: string; expectedVersion: number } | null,
) {
  const result = await getPrisma().$transaction(
    async (tx) => {
      const candidate = await scopedCandidate(
        tx,
        authority,
        candidateId,
        trackedRepositoryId,
      );
      if (!candidate) throw new DraftingError("DRAFT_CANDIDATE_NOT_FOUND");
      if (candidate.reviewStatus === "ACCEPTED" && candidate.acceptedClaimId) {
        const claim = await tx.evidenceClaim.findUniqueOrThrow({
          where: { id: candidate.acceptedClaimId },
        });
        return { stale: false as const, claim };
      }
      if (
        candidate.reviewStatus !== "READY" ||
        candidate.groundingStatus !== "VALID"
      )
        throw new DraftingError("DRAFT_CANDIDATE_NOT_ACCEPTABLE");
      const freshSelections = await tx.draftGenerationEvidence.findMany({
        where: { draftRequestId: candidate.requestId },
        include: { repositoryEvidence: true },
      });
      if (
        freshSelections.length === 0 ||
        freshSelections.some(
          (selection) =>
            selection.trackedRepositoryId !==
              candidate.request.trackedRepositoryId ||
            selection.repositoryEvidence.sourceAvailability !== "AVAILABLE" ||
            selection.repositoryEvidence.normalizedContentHash !==
              selection.evidenceContentHash,
        )
      ) {
        await tx.draftCandidate.update({
          where: { id: candidate.id },
          data: { groundingStatus: "STALE" },
        });
        return { stale: true as const };
      }
      const citedEvidenceIds = [
        ...new Set(
          candidate.sentences.flatMap((sentence) =>
            sentence.citations.map((citation) => citation.repositoryEvidenceId),
          ),
        ),
      ];
      if (!citedEvidenceIds.length)
        throw new DraftingError("DRAFT_CANDIDATE_INVALID");
      const claim = target
        ? await replaceExistingClaim(
            tx,
            authority,
            candidate,
            target,
            citedEvidenceIds,
          )
        : await createClaimFromCandidate(
            tx,
            authority,
            candidate,
            citedEvidenceIds,
          );
      const acceptedAt = new Date();
      await tx.draftCandidate.update({
        where: { id: candidate.id },
        data: {
          reviewStatus: "ACCEPTED",
          acceptedClaimId: claim.id,
          acceptedAt,
          reviewedByUserId: authority.userId,
        },
      });
      await tx.draftReviewEvent.createMany({
        data: [
          {
            workspaceId: authority.workspaceId,
            draftRequestId: candidate.requestId,
            candidateId: candidate.id,
            claimId: claim.id,
            actorUserId: authority.userId,
            kind: "CANDIDATE_ACCEPTED",
          },
          {
            workspaceId: authority.workspaceId,
            draftRequestId: candidate.requestId,
            candidateId: candidate.id,
            claimId: claim.id,
            actorUserId: authority.userId,
            kind: target ? "CLAIM_REPLACED" : "CLAIM_CREATED",
          },
        ],
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: authority.workspaceId,
          userId: authority.userId,
          type: target
            ? "claim.ai_assisted.replaced"
            : "claim.ai_assisted.created",
          metadata: { claimId: claim.id, candidateId: candidate.id },
        },
      });
      return { stale: false as const, claim };
    },
    { isolationLevel: "Serializable" },
  );
  if (result.stale) throw new DraftingError("DRAFT_CANDIDATE_STALE");
  return result.claim;
}

async function createClaimFromCandidate(
  tx: Prisma.TransactionClient,
  authority: ReviewAuthority,
  candidate: ScopedCandidate,
  citedEvidenceIds: string[],
) {
  const claim = await tx.evidenceClaim.create({
    data: {
      workspaceId: authority.workspaceId,
      trackedRepositoryId: candidate.request.trackedRepositoryId,
      authorUserId: authority.userId,
      statement: candidate.combinedStatement,
      status: citedEvidenceIds.length ? "DRAFT" : "NEEDS_EVIDENCE",
      origin: "AI_ASSISTED",
      humanEditedAfterAcceptance: false,
      evidenceLinks: {
        create: citedEvidenceIds.map((repositoryEvidenceId) => ({
          repositoryEvidenceId,
          trackedRepositoryId: candidate.request.trackedRepositoryId,
          linkedByUserId: authority.userId,
        })),
      },
    },
  });
  await tx.claimRevision.create({
    data: {
      claimId: claim.id,
      actorUserId: authority.userId,
      revisionNumber: claim.version,
      kind: "DRAFT_ACCEPTED",
      statementSnapshot: claim.statement,
      status: claim.status,
      changeSummary: "AI-assisted candidate accepted as a private draft.",
    },
  });
  return claim;
}

async function replaceExistingClaim(
  tx: Prisma.TransactionClient,
  authority: ReviewAuthority,
  candidate: ScopedCandidate,
  target: { claimId: string; expectedVersion: number },
  citedEvidenceIds: string[],
) {
  const claim = await tx.evidenceClaim.findFirst({
    where: {
      id: target.claimId,
      workspaceId: authority.workspaceId,
      trackedRepositoryId: candidate.request.trackedRepositoryId,
      status: { not: "ARCHIVED" },
    },
  });
  if (!claim) throw new DraftingError("DRAFT_TARGET_CLAIM_NOT_FOUND");
  if (claim.version !== target.expectedVersion)
    throw new DraftingError("CLAIM_VERSION_CONFLICT");
  const update = await tx.evidenceClaim.updateMany({
    where: { id: claim.id, version: target.expectedVersion },
    data: {
      statement: candidate.combinedStatement,
      status: citedEvidenceIds.length ? "DRAFT" : "NEEDS_EVIDENCE",
      origin: "AI_ASSISTED",
      humanEditedAfterAcceptance: false,
      verifiedAt: null,
      version: { increment: 1 },
    },
  });
  if (update.count !== 1) throw new DraftingError("CLAIM_VERSION_CONFLICT");
  await tx.claimEvidence.deleteMany({ where: { claimId: claim.id } });
  await tx.claimEvidence.createMany({
    data: citedEvidenceIds.map((repositoryEvidenceId) => ({
      claimId: claim.id,
      repositoryEvidenceId,
      trackedRepositoryId: candidate.request.trackedRepositoryId,
      linkedByUserId: authority.userId,
    })),
  });
  const updated = await tx.evidenceClaim.findUniqueOrThrow({
    where: { id: claim.id },
  });
  await tx.claimRevision.create({
    data: {
      claimId: updated.id,
      actorUserId: authority.userId,
      revisionNumber: updated.version,
      kind: "DRAFT_ACCEPTED",
      statementSnapshot: updated.statement,
      status: updated.status,
      changeSummary:
        "Existing claim replaced with an AI-assisted private draft; verification cleared.",
    },
  });
  return updated;
}

type ScopedCandidate = NonNullable<Awaited<ReturnType<typeof scopedCandidate>>>;

function scopedCandidate(
  tx: Prisma.TransactionClient,
  authority: ReviewAuthority,
  candidateId: string,
  trackedRepositoryId: string,
) {
  return tx.draftCandidate.findFirst({
    where: {
      id: candidateId,
      request: {
        workspaceId: authority.workspaceId,
        trackedRepositoryId,
        trackedRepository: { workspaceId: authority.workspaceId },
      },
    },
    include: {
      request: true,
      sentences: {
        orderBy: { position: "asc" },
        include: { citations: { orderBy: { position: "asc" } } },
      },
    },
  });
}

async function currentAuthority(): Promise<ReviewAuthority> {
  const { workspace, session } = await requireWorkspaceOwner();
  return { workspaceId: workspace.id, userId: session.user.id };
}

function optionalRejectionReason(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string")
    throw new DraftingError("DRAFT_REJECTION_REASON_INVALID");
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!normalized || normalized.length > 240 || /<[^>]*>/.test(normalized))
    throw new DraftingError("DRAFT_REJECTION_REASON_INVALID");
  return normalized;
}
