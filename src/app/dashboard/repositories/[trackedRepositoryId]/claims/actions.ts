"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveClaim,
  createClaim,
  editClaim,
  linkClaimEvidence,
  markClaimNeedsEvidence,
  restoreClaim,
  returnClaimToDraft,
  unlinkClaimEvidence,
  verifyClaim,
} from "@/lib/claims/service";

function path(repositoryId: string, claimId?: string) {
  return `/dashboard/repositories/${repositoryId}/claims${claimId ? `/${claimId}` : ""}`;
}

export async function createClaimAction(formData: FormData) {
  const repositoryId = String(formData.get("trackedRepositoryId") ?? "");
  const claim = await createClaim({
    trackedRepositoryId: repositoryId,
    statement: formData.get("statement"),
  });
  redirect(path(repositoryId, claim.id));
}

export async function editClaimAction(formData: FormData) {
  const repositoryId = String(formData.get("trackedRepositoryId") ?? "");
  const claimId = String(formData.get("claimId") ?? "");
  await editClaim({
    claimId,
    statement: formData.get("statement"),
    expectedVersion: formData.get("version"),
  });
  revalidatePath(path(repositoryId, claimId));
}

export async function linkEvidenceAction(formData: FormData) {
  const repositoryId = String(formData.get("trackedRepositoryId") ?? "");
  const claimId = String(formData.get("claimId") ?? "");
  await linkClaimEvidence({
    claimId,
    repositoryEvidenceId: String(formData.get("repositoryEvidenceId") ?? ""),
    expectedVersion: formData.get("version"),
  });
  revalidatePath(path(repositoryId, claimId));
}

export async function unlinkEvidenceAction(formData: FormData) {
  const repositoryId = String(formData.get("trackedRepositoryId") ?? "");
  const claimId = String(formData.get("claimId") ?? "");
  await unlinkClaimEvidence({
    claimId,
    repositoryEvidenceId: String(formData.get("repositoryEvidenceId") ?? ""),
    expectedVersion: formData.get("version"),
  });
  revalidatePath(path(repositoryId, claimId));
}

export async function claimStatusAction(formData: FormData) {
  const repositoryId = String(formData.get("trackedRepositoryId") ?? "");
  const claimId = String(formData.get("claimId") ?? "");
  const input = {
    claimId,
    expectedVersion: formData.get("version"),
  };
  switch (formData.get("operation")) {
    case "verify":
      await verifyClaim(input);
      break;
    case "draft":
      await returnClaimToDraft(input);
      break;
    case "needs-evidence":
      await markClaimNeedsEvidence(input);
      break;
    case "archive":
      await archiveClaim(input);
      break;
    case "restore":
      await restoreClaim(input);
      break;
    default:
      throw new Error("CLAIM_OPERATION_INVALID");
  }
  revalidatePath(path(repositoryId, claimId));
  revalidatePath(path(repositoryId));
}
