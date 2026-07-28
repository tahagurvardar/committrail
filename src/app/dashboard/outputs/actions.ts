"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import {
  archivePortfolioOutputForAuthority,
  createPortfolioOutput,
  updatePortfolioOutputForAuthority,
  type PortfolioOutputInput,
} from "@/lib/portfolio/output-service";

export async function createPortfolioOutputAction(formData: FormData) {
  const output = await createPortfolioOutput(parseOutput(formData));
  redirect(`/dashboard/outputs/${output.id}`);
}

export async function updatePortfolioOutputAction(formData: FormData) {
  const outputId = field(formData, "outputId");
  const { workspace, session } = await requireWorkspaceOwner();
  await updatePortfolioOutputForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    {
      outputId,
      expectedVersion: formData.get("expectedVersion"),
      output: parseOutput(formData),
    },
  );
  revalidatePath(`/dashboard/outputs/${outputId}`);
}

export async function archivePortfolioOutputAction(formData: FormData) {
  const outputId = field(formData, "outputId");
  const { workspace, session } = await requireWorkspaceOwner();
  await archivePortfolioOutputForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    {
      outputId,
      expectedVersion: formData.get("expectedVersion"),
      confirmation: formData.get("confirmation"),
    },
  );
  revalidatePath(`/dashboard/outputs/${outputId}`);
}

function parseOutput(formData: FormData): PortfolioOutputInput {
  const claims = formData
    .getAll("claimId")
    .map(String)
    .filter(Boolean)
    .map((claimId) => ({
      claimId,
      position: Number.parseInt(
        String(formData.get(`claimPosition:${claimId}`) ?? "0"),
        10,
      ),
      statementOverride: formData.get(`statementOverride:${claimId}`),
    }))
    .sort((left, right) => left.position - right.position)
    .map(({ claimId, statementOverride }) => ({
      claimId,
      statementOverride,
    }));
  return {
    trackedRepositoryId: field(formData, "trackedRepositoryId"),
    type: formData.get("type"),
    title: formData.get("title"),
    fields: {
      projectTitle: formData.get("projectTitle"),
      overview: formData.get("overview"),
      context: formData.get("context"),
      role: formData.get("role"),
      approach: formData.get("approach"),
      outcomes: formData.get("outcomes"),
      learning: formData.get("learning"),
      limitations: formData.get("limitations"),
      situation: formData.get("situation"),
      task: formData.get("task"),
      action: formData.get("action"),
      result: formData.get("result"),
      reflection: formData.get("reflection"),
    },
    claims,
  };
}

function field(formData: FormData, name: string): string {
  const value = String(formData.get(name) ?? "");
  if (!value) throw new Error("PORTFOLIO_OUTPUT_FORM_INVALID");
  return value;
}
