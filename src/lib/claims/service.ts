import "server-only";

import type {
  ClaimRevisionKind,
  ClaimStatus,
  Prisma,
} from "@/generated/prisma/client";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import {
  normalizeClaimStatement,
  validExpectedVersion,
} from "@/lib/claims/validation";

interface ClaimAuthority {
  workspaceId: string;
  userId: string;
}

type ScopedClaim = NonNullable<Awaited<ReturnType<typeof scopedClaim>>>;

export async function createClaim(input: {
  trackedRepositoryId: string;
  statement: unknown;
}) {
  const authority = await authorityForCurrentOwner();
  const statement = normalizeClaimStatement(input.statement);
  return getPrisma().$transaction(async (tx) => {
    const repository = await tx.trackedRepository.findFirst({
      where: {
        id: input.trackedRepositoryId,
        workspaceId: authority.workspaceId,
      },
      select: { id: true },
    });
    if (!repository) throw new Error("CLAIM_NOT_FOUND");
    const claim = await tx.evidenceClaim.create({
      data: {
        workspaceId: authority.workspaceId,
        trackedRepositoryId: repository.id,
        authorUserId: authority.userId,
        statement,
        status: "NEEDS_EVIDENCE",
      },
    });
    await writeRevision(tx, authority, claim, "CREATED", "Claim created.");
    await writeAudit(tx, authority, claim.id, "claim.created");
    return claim;
  });
}

export async function editClaim(input: {
  claimId: string;
  statement: unknown;
  expectedVersion: unknown;
}) {
  const authority = await authorityForCurrentOwner();
  const statement = normalizeClaimStatement(input.statement);
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  return mutateClaim(
    authority,
    input.claimId,
    expectedVersion,
    async (tx, claim) => {
      if (claim.status === "ARCHIVED") throw new Error("CLAIM_ARCHIVED");
      const status = claim.status === "VERIFIED" ? "DRAFT" : claim.status;
      const updated = await guardedUpdate(tx, claim.id, expectedVersion, {
        statement,
        status,
        verifiedAt: null,
      });
      await writeRevision(
        tx,
        authority,
        updated,
        "STATEMENT_EDITED",
        "Statement edited; verification cleared.",
      );
      await writeAudit(tx, authority, claim.id, "claim.edited");
      return updated;
    },
  );
}

export async function linkClaimEvidence(input: {
  claimId: string;
  repositoryEvidenceId: string;
  expectedVersion: unknown;
}) {
  const authority = await authorityForCurrentOwner();
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  return mutateClaim(
    authority,
    input.claimId,
    expectedVersion,
    async (tx, claim) => {
      if (claim.status === "ARCHIVED") throw new Error("CLAIM_ARCHIVED");
      const evidence = await tx.repositoryEvidence.findFirst({
        where: {
          id: input.repositoryEvidenceId,
          trackedRepositoryId: claim.trackedRepositoryId,
          sourceAvailability: "AVAILABLE",
          trackedRepository: { workspaceId: authority.workspaceId },
        },
        select: { id: true },
      });
      if (!evidence) throw new Error("CLAIM_NOT_FOUND");
      const duplicate = await tx.claimEvidence.findUnique({
        where: {
          claimId_repositoryEvidenceId: {
            claimId: claim.id,
            repositoryEvidenceId: evidence.id,
          },
        },
      });
      if (duplicate) throw new Error("CLAIM_EVIDENCE_ALREADY_LINKED");
      await tx.claimEvidence.create({
        data: {
          claimId: claim.id,
          repositoryEvidenceId: evidence.id,
          trackedRepositoryId: claim.trackedRepositoryId,
          linkedByUserId: authority.userId,
        },
      });
      const updated = await guardedUpdate(tx, claim.id, expectedVersion, {
        status: claim.status === "NEEDS_EVIDENCE" ? "DRAFT" : claim.status,
      });
      await writeRevision(
        tx,
        authority,
        updated,
        "EVIDENCE_LINKED",
        "Evidence linked.",
        evidence.id,
      );
      await writeAudit(tx, authority, claim.id, "claim.evidence.linked");
      return updated;
    },
  );
}

export async function unlinkClaimEvidence(input: {
  claimId: string;
  repositoryEvidenceId: string;
  expectedVersion: unknown;
}) {
  const authority = await authorityForCurrentOwner();
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  return mutateClaim(
    authority,
    input.claimId,
    expectedVersion,
    async (tx, claim) => {
      if (claim.status === "ARCHIVED") throw new Error("CLAIM_ARCHIVED");
      const removed = await tx.claimEvidence.deleteMany({
        where: {
          claimId: claim.id,
          repositoryEvidenceId: input.repositoryEvidenceId,
          repositoryEvidence: {
            trackedRepositoryId: claim.trackedRepositoryId,
            trackedRepository: { workspaceId: authority.workspaceId },
          },
        },
      });
      if (removed.count !== 1) throw new Error("CLAIM_NOT_FOUND");
      const remaining = await tx.claimEvidence.count({
        where: {
          claimId: claim.id,
          repositoryEvidence: { sourceAvailability: "AVAILABLE" },
        },
      });
      const status: ClaimStatus =
        remaining === 0
          ? "NEEDS_EVIDENCE"
          : claim.status === "VERIFIED"
            ? "DRAFT"
            : claim.status;
      const updated = await guardedUpdate(tx, claim.id, expectedVersion, {
        status,
        verifiedAt: null,
      });
      await writeRevision(
        tx,
        authority,
        updated,
        "EVIDENCE_UNLINKED",
        "Evidence unlinked; verification cleared.",
        input.repositoryEvidenceId,
      );
      await writeAudit(tx, authority, claim.id, "claim.evidence.unlinked");
      return updated;
    },
  );
}

export async function verifyClaim(input: {
  claimId: string;
  expectedVersion: unknown;
}) {
  return transitionClaim(
    input,
    "VERIFIED",
    "VERIFIED",
    "Claim owner-reviewed.",
  );
}

export async function returnClaimToDraft(input: {
  claimId: string;
  expectedVersion: unknown;
}) {
  return transitionClaim(
    input,
    "DRAFT",
    "STATUS_CHANGED",
    "Claim returned to draft.",
  );
}

export async function markClaimNeedsEvidence(input: {
  claimId: string;
  expectedVersion: unknown;
}) {
  return transitionClaim(
    input,
    "NEEDS_EVIDENCE",
    "STATUS_CHANGED",
    "Claim marked as needing evidence.",
  );
}

export async function archiveClaim(input: {
  claimId: string;
  expectedVersion: unknown;
}) {
  return transitionClaim(input, "ARCHIVED", "ARCHIVED", "Claim archived.");
}

export async function restoreClaim(input: {
  claimId: string;
  expectedVersion: unknown;
}) {
  const authority = await authorityForCurrentOwner();
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  return mutateClaim(
    authority,
    input.claimId,
    expectedVersion,
    async (tx, claim) => {
      if (claim.status !== "ARCHIVED") throw new Error("CLAIM_NOT_ARCHIVED");
      const evidenceCount = await tx.claimEvidence.count({
        where: {
          claimId: claim.id,
          repositoryEvidence: { sourceAvailability: "AVAILABLE" },
        },
      });
      const updated = await guardedUpdate(tx, claim.id, expectedVersion, {
        status: evidenceCount ? "DRAFT" : "NEEDS_EVIDENCE",
        verifiedAt: null,
      });
      await writeRevision(
        tx,
        authority,
        updated,
        "RESTORED",
        "Claim restored.",
      );
      await writeAudit(tx, authority, claim.id, "claim.restored");
      return updated;
    },
  );
}

async function transitionClaim(
  input: { claimId: string; expectedVersion: unknown },
  nextStatus: ClaimStatus,
  kind: ClaimRevisionKind,
  summary: string,
) {
  const authority = await authorityForCurrentOwner();
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  return mutateClaim(
    authority,
    input.claimId,
    expectedVersion,
    async (tx, claim) => {
      if (claim.status === "ARCHIVED" && nextStatus !== "ARCHIVED")
        throw new Error("CLAIM_ARCHIVED");
      if (nextStatus === "VERIFIED") {
        const evidenceCount = await tx.claimEvidence.count({
          where: {
            claimId: claim.id,
            repositoryEvidence: { sourceAvailability: "AVAILABLE" },
          },
        });
        if (evidenceCount < 1) throw new Error("CLAIM_EVIDENCE_REQUIRED");
      }
      const updated = await guardedUpdate(tx, claim.id, expectedVersion, {
        status: nextStatus,
        verifiedAt: nextStatus === "VERIFIED" ? new Date() : null,
      });
      await writeRevision(tx, authority, updated, kind, summary);
      await writeAudit(
        tx,
        authority,
        claim.id,
        `claim.${nextStatus.toLowerCase()}`,
      );
      return updated;
    },
  );
}

async function authorityForCurrentOwner(): Promise<ClaimAuthority> {
  const { workspace, session } = await requireWorkspaceOwner();
  return { workspaceId: workspace.id, userId: session.user.id };
}

async function mutateClaim<T>(
  authority: ClaimAuthority,
  claimId: string,
  expectedVersion: number,
  mutation: (tx: Prisma.TransactionClient, claim: ScopedClaim) => Promise<T>,
): Promise<T> {
  return getPrisma().$transaction(
    async (tx) => {
      const claim = await scopedClaim(tx, authority.workspaceId, claimId);
      if (!claim) throw new Error("CLAIM_NOT_FOUND");
      if (claim.version !== expectedVersion)
        throw new Error("CLAIM_VERSION_CONFLICT");
      return mutation(tx, claim);
    },
    { isolationLevel: "Serializable" },
  );
}

function scopedClaim(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  claimId: string,
) {
  return tx.evidenceClaim.findFirst({
    where: {
      id: claimId,
      workspaceId,
      trackedRepository: { workspaceId },
    },
  });
}

async function guardedUpdate(
  tx: Prisma.TransactionClient,
  claimId: string,
  expectedVersion: number,
  data: Prisma.EvidenceClaimUpdateManyMutationInput,
) {
  const result = await tx.evidenceClaim.updateMany({
    where: { id: claimId, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error("CLAIM_VERSION_CONFLICT");
  return tx.evidenceClaim.findUniqueOrThrow({ where: { id: claimId } });
}

async function writeRevision(
  tx: Prisma.TransactionClient,
  authority: ClaimAuthority,
  claim: {
    id: string;
    statement: string;
    status: ClaimStatus;
    version: number;
  },
  kind: ClaimRevisionKind,
  changeSummary: string,
  evidenceIdSnapshot?: string,
) {
  await tx.claimRevision.create({
    data: {
      claimId: claim.id,
      actorUserId: authority.userId,
      revisionNumber: claim.version,
      kind,
      statementSnapshot: claim.statement,
      status: claim.status,
      evidenceIdSnapshot,
      changeSummary,
    },
  });
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  authority: ClaimAuthority,
  claimId: string,
  type: string,
) {
  await tx.auditEvent.create({
    data: {
      workspaceId: authority.workspaceId,
      userId: authority.userId,
      type,
      metadata: { claimId },
    },
  });
}
