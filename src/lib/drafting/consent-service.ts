import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { DraftingError } from "@/lib/drafting/errors";
import { getGroundedDraftProviderDescriptor } from "@/lib/drafting/provider-registry";
import {
  DRAFT_CONSENT_VERSION,
  DRAFT_PRIVACY_POLICY_VERSION,
  type DraftProviderDescriptor,
} from "@/lib/drafting/types";

type ConsentClient = Pick<Prisma.TransactionClient, "workspaceDraftingConsent">;

export async function hasCurrentExternalConsent(
  workspaceId: string,
  descriptor: DraftProviderDescriptor,
  client: ConsentClient = getPrisma(),
): Promise<boolean> {
  if (descriptor.classification !== "EXTERNAL") return true;
  const consent = await client.workspaceDraftingConsent.findFirst({
    where: {
      workspaceId,
      consentVersion: DRAFT_CONSENT_VERSION,
      privacyPolicyVersion: DRAFT_PRIVACY_POLICY_VERSION,
      providerKind: descriptor.kind,
      providerClassification: descriptor.classification,
      providerIdentityHash: descriptor.providerIdentityHash,
      revokedAt: null,
    },
    select: { id: true },
  });
  return Boolean(consent);
}

export async function grantCurrentDraftingConsent() {
  const { workspace, session } = await requireWorkspaceOwner();
  const descriptor = getGroundedDraftProviderDescriptor();
  if (!descriptor.configured)
    throw new DraftingError("DRAFT_PROVIDER_DISABLED");
  if (descriptor.classification !== "EXTERNAL")
    throw new DraftingError("DRAFT_EXTERNAL_CONSENT_NOT_REQUIRED");
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`draft-consent:${workspace.id}:${descriptor.providerIdentityHash}`}))`;
    const existing = await tx.workspaceDraftingConsent.findFirst({
      where: {
        workspaceId: workspace.id,
        consentVersion: DRAFT_CONSENT_VERSION,
        privacyPolicyVersion: DRAFT_PRIVACY_POLICY_VERSION,
        providerKind: descriptor.kind,
        providerClassification: descriptor.classification,
        providerIdentityHash: descriptor.providerIdentityHash,
        revokedAt: null,
      },
    });
    if (existing) return existing;
    const consent = await tx.workspaceDraftingConsent.create({
      data: {
        workspaceId: workspace.id,
        consentVersion: DRAFT_CONSENT_VERSION,
        privacyPolicyVersion: DRAFT_PRIVACY_POLICY_VERSION,
        providerKind: descriptor.kind,
        providerClassification: descriptor.classification,
        providerIdentityHash: descriptor.providerIdentityHash,
        acceptedByUserId: session.user.id,
      },
    });
    await tx.draftReviewEvent.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: session.user.id,
        kind: "CONSENT_GRANTED",
        metadata: {
          providerKind: descriptor.kind,
          providerClassification: descriptor.classification,
          consentVersion: DRAFT_CONSENT_VERSION,
          privacyPolicyVersion: DRAFT_PRIVACY_POLICY_VERSION,
        },
      },
    });
    return consent;
  });
}

export async function revokeCurrentDraftingConsent() {
  const { workspace, session } = await requireWorkspaceOwner();
  const descriptor = getGroundedDraftProviderDescriptor();
  if (descriptor.classification !== "EXTERNAL")
    throw new DraftingError("DRAFT_EXTERNAL_CONSENT_NOT_REQUIRED");
  return getPrisma().$transaction(async (tx) => {
    const revokedAt = new Date();
    const result = await tx.workspaceDraftingConsent.updateMany({
      where: {
        workspaceId: workspace.id,
        consentVersion: DRAFT_CONSENT_VERSION,
        privacyPolicyVersion: DRAFT_PRIVACY_POLICY_VERSION,
        providerKind: descriptor.kind,
        providerClassification: descriptor.classification,
        providerIdentityHash: descriptor.providerIdentityHash,
        revokedAt: null,
      },
      data: { revokedAt },
    });
    if (result.count) {
      await tx.draftReviewEvent.create({
        data: {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          kind: "CONSENT_REVOKED",
          metadata: {
            providerKind: descriptor.kind,
            providerClassification: descriptor.classification,
            consentVersion: DRAFT_CONSENT_VERSION,
            privacyPolicyVersion: DRAFT_PRIVACY_POLICY_VERSION,
          },
        },
      });
    }
    return result;
  });
}
