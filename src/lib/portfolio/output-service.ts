import "server-only";

import type { PortfolioOutputType, Prisma } from "@/generated/prisma/client";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { PublishingError } from "@/lib/publishing/errors";
import { contentHash, publicIdentifier } from "@/lib/publishing/hash";
import type { PublishingAuthority } from "@/lib/publishing/profile-service";
import {
  escapeMarkdown,
  normalizeOptionalPlainText,
  normalizePlainText,
  normalizePublicClaimStatement,
  safeDownloadFilename,
  validExpectedVersion,
} from "@/lib/publishing/validation";

export interface PortfolioOutputInput {
  trackedRepositoryId: string;
  type: unknown;
  title: unknown;
  fields: Record<string, unknown>;
  claims: Array<{ claimId: string; statementOverride?: unknown }>;
}

interface ClaimSnapshot {
  privateProvenance: string;
  statement: string;
  origin: "HUMAN" | "AI_ASSISTED";
  verifiedAt: string;
  evidenceCount: number;
}

interface RenderedOutput {
  structuredContent: Record<string, unknown>;
  text: string;
  markdown: string;
}

export async function createPortfolioOutput(input: PortfolioOutputInput) {
  const { workspace, session } = await requireWorkspaceOwner();
  return createPortfolioOutputForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    input,
  );
}

export async function createPortfolioOutputForAuthority(
  authority: PublishingAuthority,
  input: PortfolioOutputInput,
) {
  const normalized = normalizeOutputInput(input);
  return getPrisma().$transaction(
    async (tx) => {
      const count = await tx.portfolioOutput.count({
        where: { workspaceId: authority.workspaceId },
      });
      if (count >= 100) throw new PublishingError("PORTFOLIO_OUTPUT_LIMIT");
      const claims = await eligibleOutputClaims(tx, authority, normalized);
      const output = await tx.portfolioOutput.create({
        data: {
          workspaceId: authority.workspaceId,
          trackedRepositoryId: normalized.trackedRepositoryId,
          type: normalized.type,
          title: normalized.title,
          draftFields: normalized.fields as Prisma.InputJsonValue,
        },
      });
      await replaceOutputClaims(
        tx,
        output.id,
        output.trackedRepositoryId,
        normalized.claims,
      );
      const revision = await createOutputRevision(
        tx,
        authority,
        output,
        normalized.fields,
        claims,
        1,
      );
      const updated = await tx.portfolioOutput.update({
        where: { id: output.id },
        data: {
          status: "READY",
          currentRevisionId: revision.id,
          version: { increment: 1 },
        },
        include: { currentRevision: true },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: authority.workspaceId,
          userId: authority.userId,
          type: "portfolio_output.created",
          metadata: { outputId: output.id, type: output.type },
        },
      });
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function updatePortfolioOutputForAuthority(
  authority: PublishingAuthority,
  input: {
    outputId: string;
    expectedVersion: unknown;
    output: PortfolioOutputInput;
  },
) {
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  const normalized = normalizeOutputInput(input.output);
  return getPrisma().$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT "id"
        FROM "PortfolioOutput"
        WHERE "id" = ${input.outputId}
          AND "workspaceId" = ${authority.workspaceId}
        FOR UPDATE
      `;
      const output = await tx.portfolioOutput.findFirst({
        where: {
          id: input.outputId,
          workspaceId: authority.workspaceId,
          trackedRepository: { workspaceId: authority.workspaceId },
        },
        include: { revisions: { select: { revisionNumber: true } } },
      });
      if (!output) throw new PublishingError("PORTFOLIO_OUTPUT_NOT_FOUND");
      if (output.version !== expectedVersion)
        throw new PublishingError("PORTFOLIO_OUTPUT_VERSION_CONFLICT");
      if (output.status === "ARCHIVED")
        throw new PublishingError("PORTFOLIO_OUTPUT_ARCHIVED");
      if (
        output.trackedRepositoryId !== normalized.trackedRepositoryId ||
        output.type !== normalized.type
      )
        throw new PublishingError("PORTFOLIO_OUTPUT_SOURCE_IMMUTABLE");
      const claims = await eligibleOutputClaims(tx, authority, normalized);
      await tx.portfolioOutputClaim.deleteMany({
        where: { outputId: output.id },
      });
      await replaceOutputClaims(
        tx,
        output.id,
        output.trackedRepositoryId,
        normalized.claims,
      );
      const revisionNumber =
        Math.max(0, ...output.revisions.map((item) => item.revisionNumber)) + 1;
      const revision = await createOutputRevision(
        tx,
        authority,
        output,
        normalized.fields,
        claims,
        revisionNumber,
      );
      const updated = await tx.portfolioOutput.update({
        where: { id: output.id },
        data: {
          title: normalized.title,
          draftFields: normalized.fields as Prisma.InputJsonValue,
          status: "READY",
          currentRevisionId: revision.id,
          version: { increment: 1 },
        },
        include: { currentRevision: true },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: authority.workspaceId,
          userId: authority.userId,
          type: "portfolio_output.updated",
          metadata: { outputId: output.id, revisionNumber },
        },
      });
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function getAuthorizedPortfolioOutput(outputId: string) {
  const { workspace, session } = await requireWorkspaceOwner();
  const output = await getPrisma().portfolioOutput.findFirst({
    where: {
      id: outputId,
      workspaceId: workspace.id,
      trackedRepository: { workspaceId: workspace.id },
    },
    include: {
      currentRevision: true,
      revisions: { orderBy: { revisionNumber: "desc" } },
      claimSelections: { orderBy: { position: "asc" } },
    },
  });
  if (!output) throw new PublishingError("PORTFOLIO_OUTPUT_NOT_FOUND");
  return { output, workspace, session };
}

export async function archivePortfolioOutputForAuthority(
  authority: PublishingAuthority,
  input: { outputId: string; expectedVersion: unknown; confirmation: unknown },
) {
  if (input.confirmation !== "ARCHIVE")
    throw new PublishingError("ARCHIVE_CONFIRMATION_REQUIRED");
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  await getPrisma().$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT "id"
        FROM "PortfolioOutput"
        WHERE "id" = ${input.outputId}
          AND "workspaceId" = ${authority.workspaceId}
        FOR UPDATE
      `;
      const output = await tx.portfolioOutput.findFirst({
        where: {
          id: input.outputId,
          workspaceId: authority.workspaceId,
          trackedRepository: { workspaceId: authority.workspaceId },
        },
        select: { id: true, version: true },
      });
      if (!output) throw new PublishingError("PORTFOLIO_OUTPUT_NOT_FOUND");
      if (output.version !== expectedVersion)
        throw new PublishingError("PORTFOLIO_OUTPUT_VERSION_CONFLICT");
      await tx.portfolioOutput.update({
        where: { id: output.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: authority.workspaceId,
          userId: authority.userId,
          type: "portfolio_output.archived",
          metadata: { outputId: output.id },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function buildPrivateOutputDownload(
  authority: PublishingAuthority,
  outputId: string,
  format: "txt" | "md" | "json",
) {
  const output = await getPrisma().portfolioOutput.findFirst({
    where: {
      id: outputId,
      workspaceId: authority.workspaceId,
      trackedRepository: { workspaceId: authority.workspaceId },
      currentRevisionId: { not: null },
    },
    include: { currentRevision: true },
  });
  if (!output?.currentRevision)
    throw new PublishingError("PORTFOLIO_OUTPUT_NOT_FOUND");
  const revision = output.currentRevision;
  const body =
    format === "txt"
      ? revision.renderedText
      : format === "md"
        ? revision.renderedMarkdown
        : JSON.stringify(
            {
              schemaVersion: 1,
              type: output.type,
              title: output.title,
              revisionNumber: revision.revisionNumber,
              templateVersion: revision.templateVersion,
              contentHash: revision.contentHash,
              createdAt: revision.createdAt.toISOString(),
              content: revision.structuredContent,
            },
            null,
            2,
          );
  if (Buffer.byteLength(body, "utf8") > 128 * 1024)
    throw new PublishingError("PORTFOLIO_OUTPUT_TOO_LARGE");
  const contentType =
    format === "json"
      ? "application/json; charset=utf-8"
      : format === "md"
        ? "text/markdown; charset=utf-8"
        : "text/plain; charset=utf-8";
  return {
    body,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeDownloadFilename(
        output.title,
        format,
      )}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  };
}

function normalizeOutputInput(input: PortfolioOutputInput) {
  const type = outputType(input.type);
  if (
    input.claims.length < 1 ||
    input.claims.length > (type === "CV_BULLETS" ? 6 : 12)
  )
    throw new PublishingError("PORTFOLIO_OUTPUT_CLAIMS_INVALID");
  const unique = new Set(input.claims.map((claim) => claim.claimId));
  if (unique.size !== input.claims.length)
    throw new PublishingError("PORTFOLIO_OUTPUT_CLAIM_DUPLICATE");
  return {
    trackedRepositoryId: normalizePlainText(input.trackedRepositoryId, {
      min: 1,
      max: 100,
      code: "PORTFOLIO_OUTPUT_REPOSITORY_INVALID",
    }),
    type,
    title: normalizePlainText(input.title, {
      min: 1,
      max: 120,
      code: "PORTFOLIO_OUTPUT_TITLE_INVALID",
    }),
    fields: normalizeFields(type, input.fields),
    claims: input.claims.map((claim) => ({
      claimId: normalizePlainText(claim.claimId, {
        min: 1,
        max: 100,
        code: "PORTFOLIO_OUTPUT_CLAIM_INVALID",
      }),
      statementOverride: normalizeOptionalPlainText(claim.statementOverride, {
        max: 500,
        code: "PORTFOLIO_OUTPUT_CLAIM_TEXT_INVALID",
      }),
    })),
  };
}

async function eligibleOutputClaims(
  tx: Prisma.TransactionClient,
  authority: PublishingAuthority,
  input: ReturnType<typeof normalizeOutputInput>,
) {
  const claims = await tx.evidenceClaim.findMany({
    where: {
      id: { in: input.claims.map((claim) => claim.claimId) },
      workspaceId: authority.workspaceId,
      trackedRepositoryId: input.trackedRepositoryId,
      status: "VERIFIED",
      verifiedAt: { not: null },
    },
    include: {
      evidenceLinks: {
        where: { repositoryEvidence: { sourceAvailability: "AVAILABLE" } },
      },
      sourceCandidate: { select: { groundingStatus: true } },
    },
  });
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  return input.claims.map((selected, position): ClaimSnapshot => {
    const claim = byId.get(selected.claimId);
    if (
      !claim ||
      !claim.verifiedAt ||
      claim.evidenceLinks.length < 1 ||
      (claim.origin === "AI_ASSISTED" &&
        claim.sourceCandidate?.groundingStatus !== "VALID")
    )
      throw new PublishingError("PORTFOLIO_OUTPUT_CLAIM_INELIGIBLE");
    const statement = normalizePublicClaimStatement(
      selected.statementOverride ?? claim.statement,
    );
    return {
      privateProvenance: publicIdentifier(
        "private-claim",
        authority.workspaceId,
        claim.id,
        String(position),
      ),
      statement,
      origin: claim.origin,
      verifiedAt: claim.verifiedAt.toISOString(),
      evidenceCount: claim.evidenceLinks.length,
    };
  });
}

async function createOutputRevision(
  tx: Prisma.TransactionClient,
  authority: PublishingAuthority,
  output: { id: string; type: PortfolioOutputType; title: string },
  fields: Record<string, string | null>,
  claims: ClaimSnapshot[],
  revisionNumber: number,
) {
  const rendered = renderOutput(output.type, output.title, fields, claims);
  const hash = contentHash({
    templateVersion: 1,
    type: output.type,
    title: output.title,
    fields,
    claims,
    structuredContent: rendered.structuredContent,
  });
  return tx.portfolioOutputRevision.create({
    data: {
      outputId: output.id,
      revisionNumber,
      claimSnapshots: claims as unknown as Prisma.InputJsonValue,
      userFields: fields as Prisma.InputJsonValue,
      structuredContent: rendered.structuredContent as Prisma.InputJsonValue,
      renderedText: rendered.text,
      renderedMarkdown: rendered.markdown,
      contentHash: hash,
      createdByUserId: authority.userId,
    },
  });
}

async function replaceOutputClaims(
  tx: Prisma.TransactionClient,
  outputId: string,
  trackedRepositoryId: string,
  claims: Array<{ claimId: string; statementOverride: string | null }>,
) {
  await tx.portfolioOutputClaim.createMany({
    data: claims.map((claim, position) => ({
      outputId,
      claimId: claim.claimId,
      trackedRepositoryId,
      position,
      statementOverride: claim.statementOverride,
    })),
  });
}

function renderOutput(
  type: PortfolioOutputType,
  title: string,
  fields: Record<string, string | null>,
  claims: ClaimSnapshot[],
): RenderedOutput {
  if (type === "CV_BULLETS") {
    const bullets = claims.map((claim) => claim.statement);
    return {
      structuredContent: { title, bullets },
      text: `${title}\n\n${bullets.map((item) => `• ${item}`).join("\n")}\n`,
      markdown: `# ${escapeMarkdown(title)}\n\n${bullets
        .map((item) => `- ${escapeMarkdown(item)}`)
        .join("\n")}\n`,
    };
  }
  if (type === "INTERVIEW_STORY") {
    const sections = ["situation", "task", "action", "result", "reflection"];
    return renderSections(title, fields, sections, claims);
  }
  return renderSections(
    title,
    fields,
    [
      "projectTitle",
      "overview",
      "context",
      "role",
      "approach",
      "outcomes",
      "learning",
      "limitations",
    ],
    claims,
  );
}

function renderSections(
  title: string,
  fields: Record<string, string | null>,
  sections: string[],
  claims: ClaimSnapshot[],
): RenderedOutput {
  const entries = sections
    .map((key) => [key, fields[key]] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
  const structuredContent = {
    title,
    sections: Object.fromEntries(entries),
    evidenceBackedClaims: claims.map((claim) => claim.statement),
  };
  const textSections = entries.map(
    ([key, value]) => `${sectionLabel(key)}\n${value}`,
  );
  const markdownSections = entries.map(
    ([key, value]) =>
      `## ${escapeMarkdown(sectionLabel(key))}\n\n${escapeMarkdown(value)}`,
  );
  const claimText = claims.map((claim) => `• ${claim.statement}`).join("\n");
  const claimMarkdown = claims
    .map((claim) => `- ${escapeMarkdown(claim.statement)}`)
    .join("\n");
  return {
    structuredContent,
    text: `${title}\n\n${textSections.join(
      "\n\n",
    )}\n\nEvidence-backed claims\n${claimText}\n`,
    markdown: `# ${escapeMarkdown(title)}\n\n${markdownSections.join(
      "\n\n",
    )}\n\n## Evidence-backed claims\n\n${claimMarkdown}\n`,
  };
}

function normalizeFields(
  type: PortfolioOutputType,
  fields: Record<string, unknown>,
): Record<string, string | null> {
  const keys =
    type === "INTERVIEW_STORY"
      ? ["situation", "task", "action", "result", "reflection"]
      : type === "CASE_STUDY"
        ? [
            "projectTitle",
            "overview",
            "context",
            "role",
            "approach",
            "outcomes",
            "learning",
            "limitations",
          ]
        : [];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      normalizeOptionalPlainText(fields[key], {
        max: 1500,
        code: "PORTFOLIO_OUTPUT_FIELD_INVALID",
      }),
    ]),
  );
}

function outputType(value: unknown): PortfolioOutputType {
  if (
    value !== "CASE_STUDY" &&
    value !== "CV_BULLETS" &&
    value !== "INTERVIEW_STORY"
  )
    throw new PublishingError("PORTFOLIO_OUTPUT_TYPE_INVALID");
  return value;
}

function sectionLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}
