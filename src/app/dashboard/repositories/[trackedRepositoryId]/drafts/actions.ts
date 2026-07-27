"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  grantCurrentDraftingConsent,
  revokeCurrentDraftingConsent,
} from "@/lib/drafting/consent-service";
import {
  acceptDraftCandidateAsNewClaim,
  acceptDraftCandidateIntoClaim,
  rejectDraftCandidate,
} from "@/lib/drafting/review-service";
import {
  regenerateDraftRequest,
  requestDraftGeneration,
} from "@/lib/drafting/service";

export async function queueDraftGenerationAction(formData: FormData) {
  const trackedRepositoryId = field(formData, "trackedRepositoryId");
  const request = await requestDraftGeneration({
    trackedRepositoryId,
    evidenceIds: formData.getAll("evidenceId").map(String).filter(Boolean),
    intent: formData.get("intent"),
    style: formData.get("style"),
  });
  redirect(
    `/dashboard/repositories/${trackedRepositoryId}/drafts/${request.id}`,
  );
}

export async function grantDraftingConsentAction(formData: FormData) {
  const trackedRepositoryId = field(formData, "trackedRepositoryId");
  if (formData.get("acknowledgement") !== "accepted")
    throw new Error("DRAFT_CONSENT_ACKNOWLEDGEMENT_REQUIRED");
  await grantCurrentDraftingConsent();
  revalidatePath(`/dashboard/repositories/${trackedRepositoryId}/drafts/new`);
}

export async function revokeDraftingConsentAction(formData: FormData) {
  const trackedRepositoryId = field(formData, "trackedRepositoryId");
  await revokeCurrentDraftingConsent();
  revalidatePath(`/dashboard/repositories/${trackedRepositoryId}/drafts/new`);
}

export async function rejectDraftCandidateAction(formData: FormData) {
  const trackedRepositoryId = field(formData, "trackedRepositoryId");
  const draftRequestId = field(formData, "draftRequestId");
  await rejectDraftCandidate({
    candidateId: field(formData, "candidateId"),
    trackedRepositoryId,
    reason: formData.get("reason"),
  });
  revalidatePath(
    `/dashboard/repositories/${trackedRepositoryId}/drafts/${draftRequestId}`,
  );
}

export async function regenerateDraftAction(formData: FormData) {
  const trackedRepositoryId = field(formData, "trackedRepositoryId");
  const request = await regenerateDraftRequest(
    field(formData, "draftRequestId"),
    trackedRepositoryId,
  );
  redirect(
    `/dashboard/repositories/${trackedRepositoryId}/drafts/${request.id}`,
  );
}

export async function acceptDraftAsNewClaimAction(formData: FormData) {
  const trackedRepositoryId = field(formData, "trackedRepositoryId");
  const claim = await acceptDraftCandidateAsNewClaim(
    field(formData, "candidateId"),
    trackedRepositoryId,
  );
  redirect(`/dashboard/repositories/${trackedRepositoryId}/claims/${claim.id}`);
}

export async function acceptDraftIntoClaimAction(formData: FormData) {
  const trackedRepositoryId = field(formData, "trackedRepositoryId");
  const [claimId, version] = field(formData, "claimTarget").split(":");
  if (!claimId || !version) throw new Error("DRAFT_FORM_INVALID");
  const claim = await acceptDraftCandidateIntoClaim({
    candidateId: field(formData, "candidateId"),
    trackedRepositoryId,
    claimId,
    expectedVersion: version,
  });
  redirect(`/dashboard/repositories/${trackedRepositoryId}/claims/${claim.id}`);
}

function field(formData: FormData, name: string): string {
  const value = String(formData.get(name) ?? "");
  if (!value) throw new Error("DRAFT_FORM_INVALID");
  return value;
}
