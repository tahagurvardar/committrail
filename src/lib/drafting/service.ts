import "server-only";

import { randomUUID } from "node:crypto";
import type { DraftStyle, Prisma } from "@/generated/prisma/client";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { hasCurrentExternalConsent } from "@/lib/drafting/consent-service";
import { loadCanonicalEvidenceBundle } from "@/lib/drafting/evidence-bundle";
import { DraftingError } from "@/lib/drafting/errors";
import { getGroundedDraftProvider } from "@/lib/drafting/provider-registry";
import { draftRequestHash } from "@/lib/drafting/request-hash";
import {
  DRAFT_EVIDENCE_BUNDLE_VERSION,
  DRAFT_PROMPT_TEMPLATE_VERSION,
  type BuiltEvidenceBundle,
  type DraftProviderDescriptor,
  type GroundedDraftProvider,
} from "@/lib/drafting/types";

export const DRAFT_USER_TEN_MINUTE_LIMIT = 5;
export const DRAFT_WORKSPACE_DAILY_LIMIT = 20;

interface DraftAuthority {
  workspaceId: string;
  userId: string;
}

export async function requestDraftGeneration(input: {
  trackedRepositoryId: string;
  evidenceIds: string[];
  intent: unknown;
  style: unknown;
  regenerationOfId?: string;
}) {
  const { workspace, session } = await requireWorkspaceOwner();
  return requestDraftGenerationForAuthority(
    {
      workspaceId: workspace.id,
      userId: session.user.id,
    },
    input,
    getGroundedDraftProvider(),
  );
}

export async function requestDraftGenerationForAuthority(
  authority: DraftAuthority,
  input: {
    trackedRepositoryId: string;
    evidenceIds: string[];
    intent: unknown;
    style: unknown;
    regenerationOfId?: string;
  },
  provider: GroundedDraftProvider,
) {
  const intent = normalizeDraftIntent(input.intent);
  const style = normalizeDraftStyle(input.style);
  const descriptor = provider.descriptor;
  if (!descriptor.configured)
    throw new DraftingError("DRAFT_PROVIDER_DISABLED");
  const repository = await getPrisma().trackedRepository.findFirst({
    where: {
      id: input.trackedRepositoryId,
      workspaceId: authority.workspaceId,
      trackingStatus: "ACTIVE",
    },
    select: { id: true },
  });
  if (!repository) throw new DraftingError("DRAFT_REPOSITORY_NOT_FOUND");
  if (!(await hasCurrentExternalConsent(authority.workspaceId, descriptor)))
    throw new DraftingError("DRAFT_EXTERNAL_CONSENT_REQUIRED");
  const built = await loadCanonicalEvidenceBundle({
    workspaceId: authority.workspaceId,
    trackedRepositoryId: repository.id,
    evidenceIds: input.evidenceIds,
    maximumBytes: descriptor.maximumRequestBytes,
  });
  return enqueueDraftRequest({
    authority,
    trackedRepositoryId: repository.id,
    intent,
    style,
    descriptor,
    built,
    regenerationOfId: input.regenerationOfId,
  });
}

export async function regenerateDraftRequest(
  draftRequestId: string,
  trackedRepositoryId: string,
) {
  const { workspace, session } = await requireWorkspaceOwner();
  const existing = await getPrisma().draftGenerationRequest.findFirst({
    where: {
      id: draftRequestId,
      workspaceId: workspace.id,
      trackedRepositoryId,
    },
    include: {
      evidenceSelections: {
        orderBy: { position: "asc" },
        select: { repositoryEvidenceId: true },
      },
    },
  });
  if (!existing) throw new DraftingError("DRAFT_REQUEST_NOT_FOUND");
  return requestDraftGenerationForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    {
      trackedRepositoryId: existing.trackedRepositoryId,
      evidenceIds: existing.evidenceSelections.map(
        (item) => item.repositoryEvidenceId,
      ),
      intent: existing.draftingIntent,
      style: existing.style,
      regenerationOfId: existing.id,
    },
    getGroundedDraftProvider(),
  );
}

async function enqueueDraftRequest(input: {
  authority: DraftAuthority;
  trackedRepositoryId: string;
  intent: string;
  style: DraftStyle;
  descriptor: DraftProviderDescriptor;
  built: BuiltEvidenceBundle;
  regenerationOfId?: string;
}) {
  const regenerationNonce = input.regenerationOfId ? randomUUID() : undefined;
  const requestHash = draftRequestHash({
    workspaceId: input.authority.workspaceId,
    trackedRepositoryId: input.trackedRepositoryId,
    requestedByUserId: input.authority.userId,
    providerIdentityHash: input.descriptor.providerIdentityHash,
    promptTemplateVersion: DRAFT_PROMPT_TEMPLATE_VERSION,
    evidenceBundleHash: input.built.hash,
    draftingIntent: input.intent,
    style: input.style,
    ...(regenerationNonce ? { regenerationNonce } : {}),
  });
  return getPrisma().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`draft-request:${input.authority.workspaceId}:${input.authority.userId}`}))`;
      const activeEquivalent = await tx.draftGenerationRequest.findFirst({
        where: {
          requestHash,
          status: { in: ["QUEUED", "RUNNING"] },
          workspaceId: input.authority.workspaceId,
        },
      });
      if (activeEquivalent) return activeEquivalent;
      if (input.regenerationOfId) {
        const activeRegeneration = await tx.draftGenerationRequest.findFirst({
          where: {
            regenerationOfId: input.regenerationOfId,
            workspaceId: input.authority.workspaceId,
            requestedByUserId: input.authority.userId,
            status: { in: ["QUEUED", "RUNNING"] },
          },
        });
        if (activeRegeneration) return activeRegeneration;
      }
      const otherActive = await tx.draftGenerationRequest.findFirst({
        where: {
          workspaceId: input.authority.workspaceId,
          trackedRepositoryId: input.trackedRepositoryId,
          requestedByUserId: input.authority.userId,
          status: { in: ["QUEUED", "RUNNING"] },
        },
      });
      if (otherActive) throw new DraftingError("DRAFT_REQUEST_ALREADY_ACTIVE");
      if (!input.regenerationOfId) {
        const completedEquivalent = await tx.draftGenerationRequest.findFirst({
          where: {
            requestHash,
            workspaceId: input.authority.workspaceId,
            status: { in: ["SUCCEEDED", "FAILED", "CANCELLED"] },
          },
          select: { id: true },
        });
        if (completedEquivalent)
          throw new DraftingError("DRAFT_REGENERATION_REQUIRED");
      } else {
        const source = await tx.draftGenerationRequest.findFirst({
          where: {
            id: input.regenerationOfId,
            workspaceId: input.authority.workspaceId,
            trackedRepositoryId: input.trackedRepositoryId,
          },
          select: { id: true },
        });
        if (!source) throw new DraftingError("DRAFT_REQUEST_NOT_FOUND");
      }
      await enforceDraftRateLimits(tx, input.authority);
      const request = await tx.draftGenerationRequest.create({
        data: {
          workspaceId: input.authority.workspaceId,
          trackedRepositoryId: input.trackedRepositoryId,
          requestedByUserId: input.authority.userId,
          regenerationOfId: input.regenerationOfId,
          providerKind: input.descriptor.kind,
          providerClassification: input.descriptor.classification,
          providerIdentityHash: input.descriptor.providerIdentityHash,
          modelLabel: input.descriptor.modelLabel,
          promptTemplateVersion: DRAFT_PROMPT_TEMPLATE_VERSION,
          evidenceBundleVersion: DRAFT_EVIDENCE_BUNDLE_VERSION,
          evidenceBundleHash: input.built.hash,
          draftingIntent: input.intent,
          style: input.style,
          requestHash,
          inputEvidenceCount: input.built.bundle.evidence.length,
          inputByteCount: input.built.byteSize,
          evidenceSelections: {
            create: input.built.bundle.evidence.map((evidence, position) => ({
              repositoryEvidenceId: evidence.id,
              evidenceContentHash: evidence.contentHash,
              position,
            })),
          },
        },
      });
      const job = await tx.ingestionJob.create({
        data: {
          workspaceId: input.authority.workspaceId,
          trackedRepositoryId: input.trackedRepositoryId,
          kind: "GROUNDED_DRAFT",
          deduplicationKey: `draft:${request.id}`,
          minimalPayload: { draftRequestId: request.id },
          maximumAttempts: 5,
        },
      });
      const queued = await tx.draftGenerationRequest.update({
        where: { id: request.id },
        data: { ingestionJobId: job.id },
      });
      await tx.draftReviewEvent.create({
        data: {
          workspaceId: input.authority.workspaceId,
          draftRequestId: request.id,
          actorUserId: input.authority.userId,
          kind: "GENERATION_QUEUED",
          metadata: {
            evidenceCount: input.built.bundle.evidence.length,
            inputByteCount: input.built.byteSize,
            style: input.style,
          },
        },
      });
      return queued;
    },
    { isolationLevel: "Serializable" },
  );
}

async function enforceDraftRateLimits(
  tx: Prisma.TransactionClient,
  authority: DraftAuthority,
) {
  const now = Date.now();
  const [recentUser, recentWorkspace] = await Promise.all([
    tx.draftGenerationRequest.count({
      where: {
        workspaceId: authority.workspaceId,
        requestedByUserId: authority.userId,
        createdAt: { gte: new Date(now - 10 * 60 * 1000) },
      },
    }),
    tx.draftGenerationRequest.count({
      where: {
        workspaceId: authority.workspaceId,
        createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  if (recentUser >= DRAFT_USER_TEN_MINUTE_LIMIT)
    throw new DraftingError("DRAFT_USER_RATE_LIMITED");
  if (recentWorkspace >= DRAFT_WORKSPACE_DAILY_LIMIT)
    throw new DraftingError("DRAFT_WORKSPACE_RATE_LIMITED");
}

export function normalizeDraftIntent(value: unknown): string {
  if (typeof value !== "string")
    throw new DraftingError("DRAFT_INTENT_INVALID");
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!normalized || normalized.length > 500)
    throw new DraftingError("DRAFT_INTENT_INVALID");
  if (
    /<[^>]*>|\b(?:system prompt|hidden prompt|api key|provider secret)\b|ignore\s+(?:all\s+)?(?:previous|system)(?:\s+system)?\s+instructions|\b(?:rank|score)\s+(?:the\s+)?developer\b/i.test(
      normalized,
    )
  )
    throw new DraftingError("DRAFT_INTENT_POLICY_VIOLATION");
  return normalized;
}

export function normalizeDraftStyle(value: unknown): DraftStyle {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  if (!["CONCISE", "TECHNICAL", "INTERVIEW"].includes(normalized))
    throw new DraftingError("DRAFT_STYLE_INVALID");
  return normalized as DraftStyle;
}
