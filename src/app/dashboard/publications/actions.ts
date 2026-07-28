"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { refreshPublicationHealth } from "@/lib/publishing/health-service";
import {
  archivePublicationForAuthority,
  createPublicationDraft,
  publishPublication,
  restorePublicationForAuthority,
  unpublishPublication,
  updatePublicationDraft,
} from "@/lib/publishing/publication-service";
import type { PublicationDraftInput } from "@/lib/publishing/types";

export async function createPublicationAction(formData: FormData) {
  const publication = await createPublicationDraft(parseDraft(formData));
  redirect(`/dashboard/publications/${publication.id}`);
}

export async function updatePublicationAction(formData: FormData) {
  const publicationId = field(formData, "publicationId");
  await updatePublicationDraft({
    publicationId,
    expectedVersion: formData.get("expectedVersion"),
    draft: parseDraft(formData),
  });
  revalidatePath(`/dashboard/publications/${publicationId}`);
  revalidatePath(`/dashboard/publications/${publicationId}/preview`);
}

export async function publishPublicationAction(formData: FormData) {
  const publicationId = field(formData, "publicationId");
  await publishPublication({
    publicationId,
    confirmation: {
      expectedVersion: formData.get("expectedVersion"),
      confirmation: formData.get("confirmation"),
      publicDisclosureAcknowledged:
        formData.get("publicDisclosureAcknowledged") === "accepted",
      privateSourceAcknowledged:
        formData.get("privateSourceAcknowledged") === "accepted",
      idempotencyKey: formData.get("idempotencyKey"),
    },
  });
  revalidatePath(`/dashboard/publications/${publicationId}`);
  revalidatePath(`/dashboard/publications/${publicationId}/history`);
}

export async function unpublishPublicationAction(formData: FormData) {
  const publicationId = field(formData, "publicationId");
  await unpublishPublication({
    publicationId,
    expectedVersion: formData.get("expectedVersion"),
    confirmation: formData.get("confirmation"),
  });
  revalidatePath(`/dashboard/publications/${publicationId}`);
}

export async function archivePublicationAction(formData: FormData) {
  const publicationId = field(formData, "publicationId");
  const { workspace, session } = await requireWorkspaceOwner();
  await archivePublicationForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    {
      publicationId,
      expectedVersion: formData.get("expectedVersion"),
      confirmation: formData.get("confirmation"),
    },
  );
  revalidatePath(`/dashboard/publications/${publicationId}`);
}

export async function restorePublicationAction(formData: FormData) {
  const publicationId = field(formData, "publicationId");
  const { workspace, session } = await requireWorkspaceOwner();
  await restorePublicationForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    {
      publicationId,
      expectedVersion: formData.get("expectedVersion"),
    },
  );
  revalidatePath(`/dashboard/publications/${publicationId}`);
}

export async function refreshPublicationHealthAction(formData: FormData) {
  const publicationId = field(formData, "publicationId");
  await refreshPublicationHealth(publicationId);
  revalidatePath(`/dashboard/publications/${publicationId}`);
}

function parseDraft(formData: FormData): PublicationDraftInput {
  const claims = formData
    .getAll("claimId")
    .map(String)
    .filter(Boolean)
    .map((claimId) => {
      const prefix = `disclosureMode:${claimId}:`;
      const evidence: PublicationDraftInput["claims"][number]["evidence"] = [];
      for (const [key, value] of formData.entries()) {
        if (!key.startsWith(prefix) || !value) continue;
        const repositoryEvidenceId = key.slice(prefix.length);
        evidence.push({
          repositoryEvidenceId,
          mode: String(value),
          publicTitle: formData.get(
            `publicTitle:${claimId}:${repositoryEvidenceId}`,
          ),
          includeOccurredAt:
            formData.get(`includeDate:${claimId}:${repositoryEvidenceId}`) ===
            "yes",
        });
      }
      return {
        claimId,
        position: Number.parseInt(
          String(formData.get(`claimPosition:${claimId}`) ?? "0"),
          10,
        ),
        evidence,
      };
    })
    .sort((left, right) => left.position - right.position)
    .map(({ claimId, evidence }) => ({ claimId, evidence }));
  return {
    trackedRepositoryId: field(formData, "trackedRepositoryId"),
    slug: formData.get("slug"),
    internalTitle: formData.get("internalTitle"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    roleText: formData.get("roleText"),
    projectPeriodText: formData.get("projectPeriodText"),
    technologyLabels: formData.get("technologyLabels"),
    problemText: formData.get("problemText"),
    approachText: formData.get("approachText"),
    outcomeText: formData.get("outcomeText"),
    repositoryDisclosurePolicy: formData.get("repositoryDisclosurePolicy"),
    visibility: formData.get("visibility"),
    claims,
  };
}

function field(formData: FormData, name: string): string {
  const value = String(formData.get(name) ?? "");
  if (!value) throw new Error("PUBLICATION_FORM_INVALID");
  return value;
}
