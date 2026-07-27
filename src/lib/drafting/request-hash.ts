import { createHash } from "node:crypto";
import { stableJson } from "@/lib/drafting/evidence-bundle";

export function draftRequestHash(input: {
  workspaceId: string;
  trackedRepositoryId: string;
  requestedByUserId: string;
  providerIdentityHash: string;
  promptTemplateVersion: number;
  evidenceBundleHash: string;
  draftingIntent: string;
  style: string;
  regenerationNonce?: string;
}): string {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}
