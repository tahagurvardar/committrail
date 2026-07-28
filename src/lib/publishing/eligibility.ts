import "server-only";

import type { EvidenceDisclosureMode, Prisma } from "@/generated/prisma/client";
import { contentHash } from "./hash";
import { PublishingError } from "./errors";
import type { PublicationDraftInput } from "./types";
import {
  assertNoPrivateSourceIdentifiers,
  normalizeOptionalPlainText,
  normalizePublicClaimStatement,
  normalizePublicUrl,
} from "./validation";

export interface EligibleEvidence {
  id: string;
  evidenceType: string;
  occurredAt: Date;
  originalTitle: string;
  normalizedContentHash: string;
  mode: EvidenceDisclosureMode;
  publicTitle: string;
  includeOccurredAt: boolean;
  canonicalPublicSourceUrl: string | null;
  publicProvenanceText: string;
}

export interface EligibleClaim {
  id: string;
  statement: string;
  statementHash: string;
  origin: "HUMAN" | "AI_ASSISTED";
  verifiedAt: Date;
  humanEdited: boolean;
  evidence: EligibleEvidence[];
}

export interface EligibilityResult {
  repository: {
    id: string;
    visibility: string;
    ownerLogin: string;
    name: string;
    fullName: string;
  };
  claims: EligibleClaim[];
  includesPrivateSource: boolean;
  privateForbiddenValues: string[];
}

export async function validatePublicationEligibility(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    trackedRepositoryId: string;
    claims: PublicationDraftInput["claims"];
    selectedHashes?: Map<string, string>;
    selectedEvidenceHashes?: Map<string, string>;
  },
): Promise<EligibilityResult> {
  if (input.claims.length < 1 || input.claims.length > 12)
    throw new PublishingError("PUBLICATION_CLAIMS_REQUIRED");
  const uniqueClaimIds = new Set(input.claims.map((claim) => claim.claimId));
  if (uniqueClaimIds.size !== input.claims.length)
    throw new PublishingError("PUBLICATION_CLAIM_DUPLICATE");

  const repository = await tx.trackedRepository.findFirst({
    where: {
      id: input.trackedRepositoryId,
      workspaceId: input.workspaceId,
      trackingStatus: "ACTIVE",
    },
    select: {
      id: true,
      visibility: true,
      ownerLogin: true,
      name: true,
      fullName: true,
    },
  });
  if (!repository)
    throw new PublishingError("PUBLICATION_REPOSITORY_NOT_FOUND");

  const claims = await tx.evidenceClaim.findMany({
    where: {
      id: { in: [...uniqueClaimIds] },
      workspaceId: input.workspaceId,
      trackedRepositoryId: repository.id,
    },
    include: {
      sourceCandidate: { select: { groundingStatus: true } },
      evidenceLinks: {
        include: { repositoryEvidence: true },
      },
    },
  });
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  const eligible: EligibleClaim[] = [];
  let includesPrivateSource = false;
  const privateForbiddenValues = new Set<string>();
  const repositoryIsPrivate = repository.visibility.toLowerCase() !== "public";
  if (repositoryIsPrivate) {
    privateForbiddenValues.add(repository.ownerLogin);
    privateForbiddenValues.add(repository.name);
    privateForbiddenValues.add(repository.fullName);
  }

  for (const selected of input.claims) {
    const claim = byId.get(selected.claimId);
    if (
      !claim ||
      claim.status !== "VERIFIED" ||
      !claim.verifiedAt ||
      claim.evidenceLinks.length < 1
    )
      throw new PublishingError("PUBLICATION_CLAIM_INELIGIBLE");
    if (
      claim.origin === "AI_ASSISTED" &&
      claim.sourceCandidate?.groundingStatus !== "VALID"
    )
      throw new PublishingError("PUBLICATION_AI_CLAIM_UNVERIFIED");
    const statement = normalizePublicClaimStatement(claim.statement);
    const statementHash = contentHash(statement);
    const selectedHash = input.selectedHashes?.get(claim.id);
    if (selectedHash && selectedHash !== statementHash)
      throw new PublishingError("PUBLICATION_CLAIM_CHANGED");
    if (selected.evidence.length < 1)
      throw new PublishingError("PUBLICATION_DISCLOSURE_REQUIRED");
    const linkedById = new Map(
      claim.evidenceLinks.map((link) => [
        link.repositoryEvidenceId,
        link.repositoryEvidence,
      ]),
    );
    const uniqueEvidenceIds = new Set(
      selected.evidence.map((evidence) => evidence.repositoryEvidenceId),
    );
    if (uniqueEvidenceIds.size !== selected.evidence.length)
      throw new PublishingError("PUBLICATION_DISCLOSURE_DUPLICATE");
    const evidence: EligibleEvidence[] = [];
    for (const disclosure of selected.evidence) {
      const source = linkedById.get(disclosure.repositoryEvidenceId);
      if (
        !source ||
        source.trackedRepositoryId !== repository.id ||
        source.sourceAvailability !== "AVAILABLE"
      )
        throw new PublishingError("PUBLICATION_EVIDENCE_INELIGIBLE");
      const selectedEvidenceHash = input.selectedEvidenceHashes?.get(
        `${claim.id}:${source.id}`,
      );
      if (
        selectedEvidenceHash &&
        selectedEvidenceHash !== source.normalizedContentHash
      )
        throw new PublishingError("PUBLICATION_EVIDENCE_CHANGED");
      const mode = disclosureMode(disclosure.mode);
      if (repositoryIsPrivate) {
        includesPrivateSource = true;
        for (const value of privateEvidenceIdentifiers(source))
          privateForbiddenValues.add(value);
        if (mode !== "PRIVATE_SOURCE_REDACTED")
          throw new PublishingError("PRIVATE_SOURCE_REDACTION_REQUIRED");
      }
      if (!repositoryIsPrivate && mode === "PRIVATE_SOURCE_REDACTED")
        throw new PublishingError("PUBLIC_SOURCE_MODE_INVALID");
      const approvedTitle = normalizeOptionalPlainText(disclosure.publicTitle, {
        max: 160,
        code: "PUBLIC_EVIDENCE_TITLE_INVALID",
      });
      const sourceUrl =
        mode === "PUBLIC_SOURCE"
          ? validateGitHubEvidenceUrl(
              source.canonicalUrl,
              repository,
              source.evidenceType,
            )
          : null;
      evidence.push({
        id: source.id,
        evidenceType: normalizeEvidenceType(source.evidenceType),
        occurredAt: source.occurredAt,
        originalTitle: source.title,
        normalizedContentHash: source.normalizedContentHash,
        mode,
        publicTitle:
          approvedTitle ??
          (mode === "PRIVATE_SOURCE_REDACTED"
            ? "Private repository evidence"
            : (normalizeOptionalPlainText(source.title, {
                max: 160,
                code: "PUBLIC_EVIDENCE_TITLE_INVALID",
              }) ?? "Repository evidence")),
        includeOccurredAt: disclosure.includeOccurredAt !== false,
        canonicalPublicSourceUrl: sourceUrl,
        publicProvenanceText:
          mode === "PUBLIC_SOURCE"
            ? "Public GitHub source supplied by the author."
            : mode === "SUMMARY_ONLY"
              ? "The author included a factual summary without a public source link."
              : "Source evidence belongs to a private repository and is not publicly accessible.",
      });
    }
    if (repositoryIsPrivate) {
      assertNoPrivateSourceIdentifiers(
        [statement, ...evidence.map((item) => item.publicTitle)],
        [...privateForbiddenValues],
      );
    }
    eligible.push({
      id: claim.id,
      statement,
      statementHash,
      origin: claim.origin,
      verifiedAt: claim.verifiedAt,
      humanEdited: claim.humanEditedAfterAcceptance,
      evidence,
    });
  }
  return {
    repository,
    claims: eligible,
    includesPrivateSource,
    privateForbiddenValues: [...privateForbiddenValues],
  };
}

function disclosureMode(value: unknown): EvidenceDisclosureMode {
  if (
    value !== "PUBLIC_SOURCE" &&
    value !== "SUMMARY_ONLY" &&
    value !== "PRIVATE_SOURCE_REDACTED"
  )
    throw new PublishingError("PUBLICATION_DISCLOSURE_MODE_INVALID");
  return value;
}

function validateGitHubEvidenceUrl(
  value: string,
  repository: { ownerLogin: string; name: string },
  evidenceType: string,
): string {
  const safe = normalizePublicUrl(value, "PUBLIC_EVIDENCE_URL_INVALID");
  if (!safe) throw new PublishingError("PUBLIC_EVIDENCE_URL_INVALID");
  const url = new URL(safe);
  const prefix = `/${escapeRegExp(repository.ownerLogin)}/${escapeRegExp(
    repository.name,
  )}`;
  const sourcePattern: Record<string, string> = {
    commit: "/commit/[0-9a-f]{7,40}",
    "pull-request": "/pull/[1-9][0-9]*",
    issue: "/issues/[1-9][0-9]*",
    release: "/releases/tag/[^/]+",
    "workflow-run": "/actions/runs/[1-9][0-9]*",
  };
  const suffix = sourcePattern[evidenceType];
  if (
    url.hostname !== "github.com" ||
    url.pathname.includes("%") ||
    !suffix ||
    !new RegExp(`^${prefix}${suffix}/?$`, "i").test(url.pathname)
  )
    throw new PublishingError("PUBLIC_EVIDENCE_URL_INVALID");
  return url.toString();
}

function normalizeEvidenceType(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!normalized || normalized.length > 40)
    throw new PublishingError("PUBLIC_EVIDENCE_TYPE_INVALID");
  return normalized;
}

function privateEvidenceIdentifiers(source: {
  canonicalUrl: string;
  githubSourceId: string;
  title: string;
  factualPayload: Prisma.JsonValue;
}): string[] {
  const values = new Set<string>([
    source.canonicalUrl,
    source.githubSourceId,
    source.title,
  ]);
  collectPrivateIdentifiers(source.factualPayload, values);
  return [...values];
}

function collectPrivateIdentifiers(
  value: Prisma.JsonValue | undefined,
  values: Set<string>,
  key = "",
): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collectPrivateIdentifiers(item, values, key);
    return;
  }
  if (value && typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value))
      collectPrivateIdentifiers(nestedValue, values, nestedKey);
    return;
  }
  if (!/(?:sha|branch|ref|number|owner|repo|repository|login|url)/i.test(key))
    return;
  if (typeof value === "string" || typeof value === "number")
    values.add(String(value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
