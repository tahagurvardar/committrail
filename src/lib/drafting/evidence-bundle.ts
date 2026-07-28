import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { DraftingError } from "@/lib/drafting/errors";
import {
  DRAFT_EVIDENCE_BUNDLE_VERSION,
  DRAFT_MAX_EVIDENCE_COUNT,
  type BuiltEvidenceBundle,
  type GroundedEvidenceItem,
} from "@/lib/drafting/types";
import { safeGitHubSourceUrl } from "@/lib/evidence/safe-source-url";

interface EvidenceBundleRecord {
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
}

export async function loadCanonicalEvidenceBundle(input: {
  workspaceId: string;
  trackedRepositoryId: string;
  evidenceIds: string[];
  maximumBytes: number;
}): Promise<BuiltEvidenceBundle> {
  validateSelection(input.evidenceIds);
  const records = await getPrisma().repositoryEvidence.findMany({
    where: {
      id: { in: input.evidenceIds },
      trackedRepositoryId: input.trackedRepositoryId,
      trackedRepository: {
        workspaceId: input.workspaceId,
        trackingStatus: "ACTIVE",
      },
    },
    select: {
      id: true,
      evidenceId: true,
      evidenceType: true,
      occurredAt: true,
      title: true,
      canonicalUrl: true,
      confidence: true,
      normalizedContentHash: true,
      sourceAvailability: true,
      factualPayload: true,
    },
  });
  if (records.length !== input.evidenceIds.length)
    throw new DraftingError("DRAFT_EVIDENCE_NOT_FOUND");
  return buildEvidenceBundleFromRecords(records, input.maximumBytes);
}

export function buildEvidenceBundleFromRecords(
  records: EvidenceBundleRecord[],
  maximumBytes: number,
): BuiltEvidenceBundle {
  validateSelection(records.map((record) => record.id));
  const evidence = [...records]
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId))
    .map(canonicalEvidenceItem);
  const bundle = {
    schemaVersion: DRAFT_EVIDENCE_BUNDLE_VERSION,
    evidence,
    orderedEvidenceIds: evidence.map((item) => item.id),
    contentHashes: evidence.map((item) => item.contentHash),
  };
  const serialized = stableJson(bundle);
  const byteSize = Buffer.byteLength(serialized, "utf8");
  if (byteSize > maximumBytes)
    throw new DraftingError("DRAFT_EVIDENCE_BUNDLE_TOO_LARGE");
  return {
    bundle,
    byteSize,
    hash: createHash("sha256").update(serialized).digest("hex"),
  };
}

function canonicalEvidenceItem(
  record: EvidenceBundleRecord,
): GroundedEvidenceItem {
  if (record.sourceAvailability !== "AVAILABLE")
    throw new DraftingError("DRAFT_EVIDENCE_UNAVAILABLE");
  if (!/^[a-f0-9]{64}$/.test(record.normalizedContentHash))
    throw new DraftingError("DRAFT_EVIDENCE_INVALID_HASH");
  const sourceUrl = safeGitHubSourceUrl(record.canonicalUrl);
  if (!sourceUrl) throw new DraftingError("DRAFT_EVIDENCE_UNSAFE_URL");
  return {
    id: record.id,
    type: boundedPlainText(record.evidenceType, 40),
    occurredAt: record.occurredAt.toISOString(),
    title: boundedPlainText(record.title, 240),
    sourceUrl,
    confidence: boundedPlainText(record.confidence, 40),
    contentHash: record.normalizedContentHash,
    facts: factualWhitelist(record.evidenceType, record.factualPayload),
  };
}

function factualWhitelist(
  evidenceType: string,
  payload: Prisma.JsonValue,
): Record<string, unknown> {
  const source = asRecord(payload);
  const keys: Record<string, readonly string[]> = {
    commit: ["sha", "shortSha", "committedAt", "verification"],
    "pull-request": [
      "number",
      "state",
      "draft",
      "createdAt",
      "updatedAt",
      "closedAt",
      "mergedAt",
      "baseBranch",
      "headBranch",
    ],
    issue: [
      "number",
      "state",
      "stateReason",
      "createdAt",
      "updatedAt",
      "closedAt",
      "commentCount",
      "labels",
    ],
    release: [
      "tagName",
      "releaseName",
      "draft",
      "prerelease",
      "immutable",
      "createdAt",
      "publishedAt",
      "assetCount",
    ],
    "workflow-run": [
      "workflowName",
      "runNumber",
      "event",
      "status",
      "conclusion",
      "headBranch",
      "headSha",
      "createdAt",
      "updatedAt",
      "runStartedAt",
    ],
  };
  const allowed = keys[evidenceType];
  if (!allowed) throw new DraftingError("DRAFT_EVIDENCE_TYPE_UNSUPPORTED");
  return Object.fromEntries(
    allowed
      .filter((key) => Object.hasOwn(source, key))
      .map((key) => [key, safeFact(key, source[key])]),
  );
}

function safeFact(key: string, value: Prisma.JsonValue | undefined): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (typeof value === "string") return boundedPlainText(value, 240);
  if (key === "labels" && Array.isArray(value))
    return value.slice(0, 20).map((item) => {
      if (typeof item === "string") return boundedPlainText(item, 80);
      const name = asRecord(item).name;
      return typeof name === "string" ? boundedPlainText(name, 80) : null;
    });
  return null;
}

function validateSelection(ids: string[]) {
  if (ids.length < 1) throw new DraftingError("DRAFT_EVIDENCE_REQUIRED");
  if (ids.length > DRAFT_MAX_EVIDENCE_COUNT)
    throw new DraftingError("DRAFT_TOO_MANY_EVIDENCE_ITEMS");
  if (new Set(ids).size !== ids.length)
    throw new DraftingError("DRAFT_DUPLICATE_EVIDENCE");
  if (ids.some((id) => !/^[a-z0-9]{20,40}$/i.test(id)))
    throw new DraftingError("DRAFT_EVIDENCE_INVALID_ID");
}

function boundedPlainText(value: string, maximum: number): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!normalized || normalized.length > maximum)
    throw new DraftingError("DRAFT_EVIDENCE_INVALID_TEXT");
  return normalized;
}

function asRecord(
  value: Prisma.JsonValue | undefined,
): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
