import "server-only";

import type {
  Prisma,
  ProjectPublication,
  PublicationEventKind,
} from "@/generated/prisma/client";
import { unstable_cache } from "next/cache";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import {
  invalidatePublicProfile,
  invalidatePublicProject,
  projectCacheTag,
} from "./cache";
import {
  type EligibilityResult,
  validatePublicationEligibility,
} from "./eligibility";
import { PublishingError } from "./errors";
import { contentHash, publicIdentifier } from "./hash";
import type { PublishingAuthority } from "./profile-service";
import { reserveSlug } from "./profile-service";
import type {
  PublicationDraftInput,
  PublicProjectView,
  PublishConfirmation,
} from "./types";
import {
  assertNoPrivateSourceIdentifiers,
  normalizeOptionalPlainText,
  normalizePlainText,
  normalizePublicSlug,
  normalizeTechnologyLabels,
  validExpectedVersion,
} from "./validation";

const PUBLICATION_SCHEMA_VERSION = 1;
const AI_DISCLOSURE =
  "AI-assisted wording, reviewed and verified by the author.";

type PublicationWithDraft = NonNullable<
  Awaited<ReturnType<typeof loadPublicationDraft>>
>;

export async function getAuthorizedPublication(publicationId: string) {
  const { workspace, session } = await requireWorkspaceOwner();
  const publication = await getAuthorizedPublicationForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    publicationId,
  );
  return { publication, workspace, session };
}

export async function getAuthorizedPublicationForAuthority(
  authority: PublishingAuthority,
  publicationId: string,
) {
  const publication = await loadPublicationDraft(
    getPrisma(),
    authority.workspaceId,
    publicationId,
  );
  if (!publication) throw new PublishingError("PUBLICATION_NOT_FOUND");
  return publication;
}

export async function createPublicationDraft(input: PublicationDraftInput) {
  const { workspace, session } = await requireWorkspaceOwner();
  return createPublicationDraftForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    input,
  );
}

export async function createPublicationDraftForAuthority(
  authority: PublishingAuthority,
  input: PublicationDraftInput,
) {
  const normalized = normalizeDraftInput(input);
  const publication = await getPrisma().$transaction(
    async (tx) => {
      const profile = await ownedProfile(tx, authority);
      const draftCount = await tx.projectPublication.count({
        where: { workspaceId: authority.workspaceId },
      });
      if (draftCount >= 100)
        throw new PublishingError("PUBLICATION_DRAFT_LIMIT");
      await reserveSlug(tx, authority.workspaceId, normalized.slug, "PROJECT");
      const eligibility = await validatePublicationEligibility(tx, {
        workspaceId: authority.workspaceId,
        trackedRepositoryId: normalized.trackedRepositoryId,
        claims: normalized.claims,
      });
      validateRepositoryDisclosure(
        normalized.repositoryDisclosurePolicy,
        eligibility.repository.visibility,
      );
      validatePrivateDraftPrivacy(normalized, eligibility);
      const created = await tx.projectPublication.create({
        data: {
          workspaceId: authority.workspaceId,
          trackedRepositoryId: eligibility.repository.id,
          profileId: profile.id,
          ...publicationFields(normalized),
        },
      });
      await replaceSelections(tx, created, eligibility);
      await writePublicationEvent(tx, authority, created.id, "DRAFT_CREATED");
      await writeAudit(tx, authority, created.id, "publication.draft.created");
      return created;
    },
    { isolationLevel: "Serializable" },
  );
  return publication;
}

export async function updatePublicationDraft(input: {
  publicationId: string;
  expectedVersion: unknown;
  draft: PublicationDraftInput;
}) {
  const { workspace, session } = await requireWorkspaceOwner();
  return updatePublicationDraftForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    input,
  );
}

export async function updatePublicationDraftForAuthority(
  authority: PublishingAuthority,
  input: {
    publicationId: string;
    expectedVersion: unknown;
    draft: PublicationDraftInput;
  },
) {
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  const normalized = normalizeDraftInput(input.draft);
  const result = await getPrisma().$transaction(
    async (tx) => {
      await lockPublication(tx, authority.workspaceId, input.publicationId);
      const publication = await scopedPublication(
        tx,
        authority.workspaceId,
        input.publicationId,
      );
      if (!publication) throw new PublishingError("PUBLICATION_NOT_FOUND");
      if (publication.version !== expectedVersion)
        throw new PublishingError("PUBLICATION_VERSION_CONFLICT");
      if (publication.status === "ARCHIVED")
        throw new PublishingError("PUBLICATION_ARCHIVED");
      if (publication.trackedRepositoryId !== normalized.trackedRepositoryId)
        throw new PublishingError("PUBLICATION_REPOSITORY_IMMUTABLE");
      if (publication.firstPublishedAt && publication.slug !== normalized.slug)
        throw new PublishingError("PROJECT_SLUG_IMMUTABLE");
      if (publication.slug !== normalized.slug)
        await reserveSlug(
          tx,
          authority.workspaceId,
          normalized.slug,
          "PROJECT",
        );
      const eligibility = await validatePublicationEligibility(tx, {
        workspaceId: authority.workspaceId,
        trackedRepositoryId: publication.trackedRepositoryId,
        claims: normalized.claims,
      });
      validateRepositoryDisclosure(
        normalized.repositoryDisclosurePolicy,
        eligibility.repository.visibility,
      );
      validatePrivateDraftPrivacy(normalized, eligibility);
      const updatedCount = await tx.projectPublication.updateMany({
        where: {
          id: publication.id,
          workspaceId: authority.workspaceId,
          version: expectedVersion,
        },
        data: {
          ...publicationFields(normalized),
          version: { increment: 1 },
        },
      });
      if (updatedCount.count !== 1)
        throw new PublishingError("PUBLICATION_VERSION_CONFLICT");
      await tx.publicationClaimSelection.deleteMany({
        where: { publicationId: publication.id },
      });
      await replaceSelections(tx, publication, eligibility);
      if (publication.visibility !== normalized.visibility) {
        await writePublicationEvent(
          tx,
          authority,
          publication.id,
          "VISIBILITY_CHANGED",
          { visibility: normalized.visibility },
        );
      }
      await writeAudit(
        tx,
        authority,
        publication.id,
        "publication.draft.updated",
      );
      return tx.projectPublication.findUniqueOrThrow({
        where: { id: publication.id },
      });
    },
    { isolationLevel: "Serializable" },
  );
  return result;
}

export async function previewPublication(publicationId: string) {
  const { workspace, session } = await requireWorkspaceOwner();
  return previewPublicationForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    publicationId,
  );
}

export async function previewPublicationForAuthority(
  authority: PublishingAuthority,
  publicationId: string,
): Promise<PublicProjectView> {
  return getPrisma().$transaction(async (tx) => {
    const publication = await loadPublicationDraft(
      tx,
      authority.workspaceId,
      publicationId,
    );
    if (!publication) throw new PublishingError("PUBLICATION_NOT_FOUND");
    const eligibility = await eligibilityFromStoredDraft(
      tx,
      authority.workspaceId,
      publication,
    );
    const view = buildPublicationSnapshot(
      publication,
      eligibility,
      new Date(),
      publication.revisions.length + 1,
    );
    await writePublicationEvent(tx, authority, publication.id, "PREVIEWED");
    return view;
  });
}

export async function publishPublication(input: {
  publicationId: string;
  confirmation: PublishConfirmation;
}) {
  const { workspace, session } = await requireWorkspaceOwner();
  return publishPublicationForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    input,
  );
}

export async function publishPublicationForAuthority(
  authority: PublishingAuthority,
  input: {
    publicationId: string;
    confirmation: PublishConfirmation;
  },
) {
  const confirmation = validatePublishConfirmation(input.confirmation);
  const result = await getPrisma().$transaction(
    async (tx) => {
      await lockPublication(tx, authority.workspaceId, input.publicationId);
      const publication = await loadPublicationDraft(
        tx,
        authority.workspaceId,
        input.publicationId,
      );
      if (!publication) throw new PublishingError("PUBLICATION_NOT_FOUND");
      if (
        publication.lastPublishIdempotencyKey === confirmation.idempotencyKey &&
        publication.currentPublishedRevision
      )
        return {
          publication,
          revision: publication.currentPublishedRevision,
          idempotent: true,
        };
      if (publication.version !== confirmation.expectedVersion)
        throw new PublishingError("PUBLICATION_VERSION_CONFLICT");
      if (publication.status === "ARCHIVED")
        throw new PublishingError("PUBLICATION_ARCHIVED");
      if (publication.profile.visibility !== "PUBLIC")
        throw new PublishingError("PUBLIC_PROFILE_MUST_BE_PUBLIC");
      await enforcePublishLimits(tx, authority.workspaceId);
      const eligibility = await eligibilityFromStoredDraft(
        tx,
        authority.workspaceId,
        publication,
      );
      if (
        eligibility.includesPrivateSource &&
        !confirmation.privateSourceAcknowledged
      )
        throw new PublishingError("PRIVATE_SOURCE_ACKNOWLEDGEMENT_REQUIRED");
      const revisionNumber = publication.revisions.length + 1;
      const publishedAt = new Date();
      const view = buildPublicationSnapshot(
        publication,
        eligibility,
        publishedAt,
        revisionNumber,
      );
      const revision = await tx.projectPublicationRevision.create({
        data: {
          publicationId: publication.id,
          revisionNumber,
          ...revisionFields(view),
          repositoryDisclosurePolicy: publication.repositoryDisclosurePolicy,
          visibility: publication.visibility,
          publishedByUserId: authority.userId,
          publishedAt,
          contentHash: view.contentHash,
          schemaVersion: PUBLICATION_SCHEMA_VERSION,
        },
      });
      for (const [claimPosition, claim] of eligibility.claims.entries()) {
        const claimView = view.claims[claimPosition];
        const claimSnapshot = await tx.publicationClaimSnapshot.create({
          data: {
            publicationRevisionId: revision.id,
            sourceClaimId: claim.id,
            publicClaimIdentifier: claimView.identifier,
            position: claimPosition,
            statement: claim.statement,
            statementHash: claim.statementHash,
            claimOrigin: claim.origin,
            verifiedAt: claim.verifiedAt,
            humanEdited: claim.humanEdited,
          },
        });
        await tx.publicationEvidenceSnapshot.createMany({
          data: claim.evidence.map((evidence, evidencePosition) => {
            const evidenceView = claimView.evidence[evidencePosition];
            return {
              publicationRevisionId: revision.id,
              publicationClaimSnapshotId: claimSnapshot.id,
              sourceRepositoryEvidenceId: evidence.id,
              publicDisclosureIdentifier: evidenceView.identifier,
              position: evidencePosition,
              evidenceType: evidenceView.type,
              publicTitle: evidenceView.title,
              occurredAt: evidence.includeOccurredAt
                ? evidence.occurredAt
                : null,
              disclosureMode: evidence.mode,
              canonicalPublicSourceUrl: evidence.canonicalPublicSourceUrl,
              sourceVisibility: eligibility.repository.visibility,
              publicProvenanceText: evidence.publicProvenanceText,
              sourceContentHash: evidence.normalizedContentHash,
              contentHash: contentHash(evidenceView),
            };
          }),
        });
      }
      if (publication.currentPublishedRevisionId) {
        await tx.projectPublicationRevision.update({
          where: { id: publication.currentPublishedRevisionId },
          data: { supersededAt: publishedAt },
        });
      }
      const wasPublishedBefore = Boolean(publication.firstPublishedAt);
      const wasUnpublished = publication.status === "UNPUBLISHED";
      const updated = await tx.projectPublication.update({
        where: { id: publication.id },
        data: {
          status: "PUBLISHED",
          currentPublishedRevisionId: revision.id,
          lastPublishIdempotencyKey: confirmation.idempotencyKey,
          firstPublishedAt: publication.firstPublishedAt ?? publishedAt,
          latestPublishedAt: publishedAt,
          unpublishedAt: null,
          healthState: "CURRENT",
          healthCheckedAt: publishedAt,
          version: { increment: 1 },
        },
      });
      const eventKind: PublicationEventKind = wasUnpublished
        ? "REPUBLISHED"
        : wasPublishedBefore
          ? "REVISION_PUBLISHED"
          : "PUBLISHED";
      await writePublicationEvent(tx, authority, publication.id, eventKind, {
        revisionNumber,
      });
      await writeAudit(tx, authority, publication.id, "publication.published");
      await tx.publicProfile.update({
        where: { id: publication.profileId },
        data: {
          firstPublishedAt: publication.profile.firstPublishedAt ?? publishedAt,
          latestPublishedAt: publishedAt,
        },
      });
      return {
        publication: { ...publication, ...updated },
        revision,
        idempotent: false,
      };
    },
    { isolationLevel: "Serializable" },
  );
  invalidatePublicProject(result.publication.slug);
  invalidatePublicProfile(result.publication.profile.slug);
  return result;
}

export async function unpublishPublication(input: {
  publicationId: string;
  expectedVersion: unknown;
  confirmation: unknown;
}) {
  const { workspace, session } = await requireWorkspaceOwner();
  return unpublishPublicationForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    input,
  );
}

export async function unpublishPublicationForAuthority(
  authority: PublishingAuthority,
  input: {
    publicationId: string;
    expectedVersion: unknown;
    confirmation: unknown;
  },
) {
  if (input.confirmation !== "UNPUBLISH")
    throw new PublishingError("UNPUBLISH_CONFIRMATION_REQUIRED");
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  const result = await transitionPublication(
    authority,
    input.publicationId,
    expectedVersion,
    async (tx, publication) => {
      if (publication.status !== "PUBLISHED")
        throw new PublishingError("PUBLICATION_NOT_PUBLISHED");
      await enforceOperationLimit(tx, authority.workspaceId);
      const updated = await tx.projectPublication.update({
        where: { id: publication.id },
        data: {
          status: "UNPUBLISHED",
          unpublishedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await writePublicationEvent(tx, authority, publication.id, "UNPUBLISHED");
      await writeAudit(
        tx,
        authority,
        publication.id,
        "publication.unpublished",
      );
      return { publication: updated, profileSlug: publication.profile.slug };
    },
  );
  invalidatePublicProject(result.publication.slug);
  invalidatePublicProfile(result.profileSlug);
  return result.publication;
}

export async function archivePublicationForAuthority(
  authority: PublishingAuthority,
  input: {
    publicationId: string;
    expectedVersion: unknown;
    confirmation: unknown;
  },
) {
  if (input.confirmation !== "ARCHIVE")
    throw new PublishingError("ARCHIVE_CONFIRMATION_REQUIRED");
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  const result = await transitionPublication(
    authority,
    input.publicationId,
    expectedVersion,
    async (tx, publication) => {
      if (publication.status === "ARCHIVED")
        throw new PublishingError("PUBLICATION_ARCHIVED");
      const updated = await tx.projectPublication.update({
        where: { id: publication.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          unpublishedAt:
            publication.status === "PUBLISHED"
              ? new Date()
              : publication.unpublishedAt,
          version: { increment: 1 },
        },
      });
      await writePublicationEvent(tx, authority, publication.id, "ARCHIVED");
      return { publication: updated, profileSlug: publication.profile.slug };
    },
  );
  invalidatePublicProject(result.publication.slug);
  invalidatePublicProfile(result.profileSlug);
  return result.publication;
}

export async function restorePublicationForAuthority(
  authority: PublishingAuthority,
  input: { publicationId: string; expectedVersion: unknown },
) {
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  return transitionPublication(
    authority,
    input.publicationId,
    expectedVersion,
    async (tx, publication) => {
      if (publication.status !== "ARCHIVED")
        throw new PublishingError("PUBLICATION_NOT_ARCHIVED");
      const updated = await tx.projectPublication.update({
        where: { id: publication.id },
        data: {
          status: publication.firstPublishedAt ? "UNPUBLISHED" : "DRAFT",
          archivedAt: null,
          version: { increment: 1 },
        },
      });
      await writePublicationEvent(tx, authority, publication.id, "RESTORED");
      return updated;
    },
  );
}

export async function getPublicPublicationBySlug(
  slugInput: string,
): Promise<PublicProjectView | null> {
  let slug: string;
  try {
    slug = normalizePublicSlug(slugInput, "PROJECT");
  } catch {
    return null;
  }
  const visible = await getPrisma().projectPublication.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      profile: { visibility: "PUBLIC" },
      trackedRepository: { trackingStatus: "ACTIVE" },
      currentPublishedRevisionId: { not: null },
    },
    select: {
      id: true,
      currentPublishedRevisionId: true,
      healthState: true,
      healthCheckedAt: true,
    },
  });
  if (!visible?.currentPublishedRevisionId) return null;
  const load = unstable_cache(
    async () => {
      const publication = await getPrisma().projectPublication.findFirst({
        where: {
          id: visible.id,
          slug,
          status: "PUBLISHED",
          profile: { visibility: "PUBLIC" },
          trackedRepository: { trackingStatus: "ACTIVE" },
          currentPublishedRevisionId: visible.currentPublishedRevisionId,
        },
        include: {
          currentPublishedRevision: {
            include: {
              claimSnapshots: {
                orderBy: { position: "asc" },
                include: {
                  evidenceSnapshots: { orderBy: { position: "asc" } },
                },
              },
            },
          },
        },
      });
      if (!publication?.currentPublishedRevision)
        throw new PublishingError("PUBLICATION_NOT_FOUND");
      return buildPublicProjectView({
        slug: publication.slug,
        healthState: publication.healthState,
        currentPublishedRevision: publication.currentPublishedRevision,
      });
    },
    [
      "public-project",
      visible.id,
      visible.currentPublishedRevisionId,
      visible.healthState,
      visible.healthCheckedAt?.toISOString() ?? "unchecked",
    ],
    { tags: [projectCacheTag(slug)], revalidate: 3600 },
  );
  try {
    return await load();
  } catch (error) {
    if (
      error instanceof PublishingError &&
      error.code === "PUBLICATION_NOT_FOUND"
    )
      return null;
    throw error;
  }
}

export function buildPublicProjectView(publication: {
  slug: string;
  healthState: "CURRENT" | "REVIEW_REQUIRED" | "SOURCE_UNAVAILABLE";
  currentPublishedRevision: NonNullable<
    PublicationWithDraft["currentPublishedRevision"]
  >;
}): PublicProjectView {
  const revision = publication.currentPublishedRevision;
  return {
    schemaVersion: 1,
    slug: publication.slug,
    title: revision.title,
    summary: revision.summary,
    role: revision.roleText,
    period: revision.projectPeriodText,
    technologies: [...revision.technologyLabels],
    problem: revision.problemText,
    approach: revision.approachText,
    outcome: revision.outcomeText,
    repositoryDisclosurePolicy: revision.repositoryDisclosurePolicy,
    publicRepositoryLabel: revision.publicRepositoryLabel,
    publicRepositoryUrl: revision.publicRepositoryUrl,
    visibility: revision.visibility,
    author: {
      slug: revision.authorSlug,
      displayName: revision.authorDisplayName,
      headline: revision.authorHeadline,
      biography: revision.authorBiography,
      location: revision.authorLocationText,
      personalWebsiteUrl: revision.authorPersonalWebsiteUrl,
      githubProfileUrl: revision.authorGithubProfileUrl,
    },
    claims: revision.claimSnapshots.map((claim) => ({
      identifier: claim.publicClaimIdentifier,
      statement: claim.statement,
      origin: claim.claimOrigin,
      verifiedAt: claim.verifiedAt.toISOString(),
      humanEdited: claim.humanEdited,
      aiAssistedDisclosure:
        claim.claimOrigin === "AI_ASSISTED" ? AI_DISCLOSURE : null,
      evidence: claim.evidenceSnapshots.map((evidence) => ({
        identifier: evidence.publicDisclosureIdentifier,
        type: evidence.evidenceType,
        title: evidence.publicTitle,
        occurredAt: evidence.occurredAt?.toISOString() ?? null,
        disclosureMode: evidence.disclosureMode,
        sourceUrl: evidence.canonicalPublicSourceUrl,
        provenance: evidence.publicProvenanceText,
        confidence: "FACT",
      })),
    })),
    publishedAt: revision.publishedAt.toISOString(),
    revisionNumber: revision.revisionNumber,
    contentHash: revision.contentHash,
    health: publication.healthState,
    healthNotice:
      publication.healthState === "REVIEW_REQUIRED"
        ? "The author is reviewing changes to source evidence after this revision was published."
        : publication.healthState === "SOURCE_UNAVAILABLE"
          ? "Some source evidence is no longer available. This immutable revision remains visible pending author review."
          : null,
  };
}

export function buildPublicationSnapshot(
  publication: PublicationWithDraft,
  eligibility: EligibilityResult,
  publishedAt: Date,
  revisionNumber: number,
): PublicProjectView {
  const publicRepository =
    publication.repositoryDisclosurePolicy === "PUBLIC_REPOSITORY" &&
    eligibility.repository.visibility.toLowerCase() === "public";
  const base = {
    schemaVersion: 1 as const,
    slug: publication.slug,
    title: publication.title,
    summary: publication.summary,
    role: publication.roleText,
    period: publication.projectPeriodText,
    technologies: [...publication.technologyLabels],
    problem: publication.problemText,
    approach: publication.approachText,
    outcome: publication.outcomeText,
    repositoryDisclosurePolicy: publication.repositoryDisclosurePolicy,
    publicRepositoryLabel: publicRepository
      ? eligibility.repository.fullName
      : null,
    publicRepositoryUrl: publicRepository
      ? `https://github.com/${eligibility.repository.ownerLogin}/${eligibility.repository.name}`
      : null,
    visibility: publication.visibility,
    author: {
      slug: publication.profile.slug,
      displayName: publication.profile.displayName,
      headline: publication.profile.headline,
      biography: publication.profile.biography,
      location: publication.profile.locationText,
      personalWebsiteUrl: publication.profile.personalWebsiteUrl,
      githubProfileUrl: publication.profile.githubProfileUrl,
    },
    claims: eligibility.claims.map((claim, claimPosition) => ({
      identifier: publicIdentifier(
        "claim",
        publication.slug,
        String(revisionNumber),
        String(claimPosition),
        claim.statementHash,
      ),
      statement: claim.statement,
      origin: claim.origin,
      verifiedAt: claim.verifiedAt.toISOString(),
      humanEdited: claim.humanEdited,
      aiAssistedDisclosure:
        claim.origin === "AI_ASSISTED" ? AI_DISCLOSURE : null,
      evidence: claim.evidence.map((evidence, evidencePosition) => ({
        identifier: publicIdentifier(
          "evidence",
          publication.slug,
          String(revisionNumber),
          String(claimPosition),
          String(evidencePosition),
          evidence.normalizedContentHash,
        ),
        type: evidence.evidenceType,
        title: evidence.publicTitle,
        occurredAt: evidence.includeOccurredAt
          ? evidence.occurredAt.toISOString()
          : null,
        disclosureMode: evidence.mode,
        sourceUrl: evidence.canonicalPublicSourceUrl,
        provenance: evidence.publicProvenanceText,
        confidence: "FACT" as const,
      })),
    })),
    publishedAt: publishedAt.toISOString(),
    revisionNumber,
    health: "CURRENT" as const,
    healthNotice: null,
  };
  return { ...base, contentHash: contentHash(base) };
}

async function transitionPublication<T>(
  authority: PublishingAuthority,
  publicationId: string,
  expectedVersion: number,
  callback: (
    tx: Prisma.TransactionClient,
    publication: PublicationWithDraft,
  ) => Promise<T>,
): Promise<T> {
  return getPrisma().$transaction(
    async (tx) => {
      await lockPublication(tx, authority.workspaceId, publicationId);
      const publication = await loadPublicationDraft(
        tx,
        authority.workspaceId,
        publicationId,
      );
      if (!publication) throw new PublishingError("PUBLICATION_NOT_FOUND");
      if (publication.version !== expectedVersion)
        throw new PublishingError("PUBLICATION_VERSION_CONFLICT");
      return callback(tx, publication);
    },
    { isolationLevel: "Serializable" },
  );
}

async function loadPublicationDraft(
  prisma: Prisma.TransactionClient | ReturnType<typeof getPrisma>,
  workspaceId: string,
  publicationId: string,
) {
  return prisma.projectPublication.findFirst({
    where: {
      id: publicationId,
      workspaceId,
      trackedRepository: { workspaceId },
      profile: { workspaceId },
    },
    include: {
      profile: true,
      revisions: { orderBy: { revisionNumber: "asc" } },
      currentPublishedRevision: {
        include: {
          claimSnapshots: {
            orderBy: { position: "asc" },
            include: {
              evidenceSnapshots: { orderBy: { position: "asc" } },
            },
          },
        },
      },
      claimSelections: {
        orderBy: { position: "asc" },
        include: {
          evidenceDisclosures: { orderBy: { position: "asc" } },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

async function scopedPublication(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  publicationId: string,
) {
  return tx.projectPublication.findFirst({
    where: {
      id: publicationId,
      workspaceId,
      trackedRepository: { workspaceId },
      profile: { workspaceId },
    },
    include: { profile: true },
  });
}

async function ownedProfile(
  tx: Prisma.TransactionClient,
  authority: PublishingAuthority,
) {
  const profile = await tx.publicProfile.findFirst({
    where: {
      workspaceId: authority.workspaceId,
      workspace: { ownerUserId: authority.userId },
    },
  });
  if (!profile) throw new PublishingError("PUBLIC_PROFILE_REQUIRED");
  return profile;
}

async function eligibilityFromStoredDraft(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  publication: PublicationWithDraft,
) {
  const eligibility = await validatePublicationEligibility(tx, {
    workspaceId,
    trackedRepositoryId: publication.trackedRepositoryId,
    claims: publication.claimSelections.map((selection) => ({
      claimId: selection.claimId,
      evidence: selection.evidenceDisclosures.map((disclosure) => ({
        repositoryEvidenceId: disclosure.repositoryEvidenceId,
        mode: disclosure.mode,
        publicTitle: disclosure.publicTitle,
        includeOccurredAt: disclosure.includeOccurredAt,
      })),
    })),
    selectedHashes: new Map(
      publication.claimSelections.map((selection) => [
        selection.claimId,
        selection.selectedStatementHash,
      ]),
    ),
    selectedEvidenceHashes: new Map(
      publication.claimSelections.flatMap((selection) =>
        selection.evidenceDisclosures.map((disclosure) => [
          `${selection.claimId}:${disclosure.repositoryEvidenceId}`,
          disclosure.sourceContentHash,
        ]),
      ),
    ),
  });
  validatePrivateDraftPrivacy(publication, eligibility);
  return eligibility;
}

async function replaceSelections(
  tx: Prisma.TransactionClient,
  publication: Pick<ProjectPublication, "id" | "trackedRepositoryId">,
  eligibility: EligibilityResult,
) {
  for (const [claimPosition, claim] of eligibility.claims.entries()) {
    await tx.publicationClaimSelection.create({
      data: {
        publicationId: publication.id,
        claimId: claim.id,
        trackedRepositoryId: publication.trackedRepositoryId,
        position: claimPosition,
        selectedStatementHash: claim.statementHash,
      },
    });
    await tx.publicationEvidenceDisclosure.createMany({
      data: claim.evidence.map((evidence, evidencePosition) => ({
        publicationId: publication.id,
        claimId: claim.id,
        repositoryEvidenceId: evidence.id,
        trackedRepositoryId: publication.trackedRepositoryId,
        position: evidencePosition,
        mode: evidence.mode,
        publicTitle: evidence.publicTitle,
        includeOccurredAt: evidence.includeOccurredAt,
        sourceContentHash: evidence.normalizedContentHash,
      })),
    });
  }
}

function normalizeDraftInput(input: PublicationDraftInput) {
  const repositoryDisclosurePolicy =
    input.repositoryDisclosurePolicy === "PUBLIC_REPOSITORY"
      ? ("PUBLIC_REPOSITORY" as const)
      : input.repositoryDisclosurePolicy === "IDENTITY_REDACTED"
        ? ("IDENTITY_REDACTED" as const)
        : null;
  const visibility =
    input.visibility === "PUBLIC"
      ? ("PUBLIC" as const)
      : input.visibility === "UNLISTED"
        ? ("UNLISTED" as const)
        : null;
  if (!repositoryDisclosurePolicy)
    throw new PublishingError("REPOSITORY_DISCLOSURE_INVALID");
  if (!visibility) throw new PublishingError("PUBLICATION_VISIBILITY_INVALID");
  return {
    trackedRepositoryId: normalizePlainText(input.trackedRepositoryId, {
      min: 1,
      max: 100,
      code: "PUBLICATION_REPOSITORY_INVALID",
    }),
    slug: normalizePublicSlug(input.slug, "PROJECT"),
    internalTitle: normalizePlainText(input.internalTitle, {
      min: 1,
      max: 120,
      code: "PUBLICATION_INTERNAL_TITLE_INVALID",
    }),
    title: normalizePlainText(input.title, {
      min: 1,
      max: 120,
      code: "PUBLICATION_TITLE_INVALID",
    }),
    summary: normalizePlainText(input.summary, {
      min: 1,
      max: 500,
      code: "PUBLICATION_SUMMARY_INVALID",
    }),
    roleText: normalizePlainText(input.roleText, {
      min: 1,
      max: 160,
      code: "PUBLICATION_ROLE_INVALID",
    }),
    projectPeriodText: normalizeOptionalPlainText(input.projectPeriodText, {
      max: 100,
      code: "PUBLICATION_PERIOD_INVALID",
    }),
    technologyLabels: normalizeTechnologyLabels(input.technologyLabels),
    problemText: normalizeOptionalPlainText(input.problemText, {
      max: 1200,
      code: "PUBLICATION_PROBLEM_INVALID",
    }),
    approachText: normalizeOptionalPlainText(input.approachText, {
      max: 1200,
      code: "PUBLICATION_APPROACH_INVALID",
    }),
    outcomeText: normalizeOptionalPlainText(input.outcomeText, {
      max: 1200,
      code: "PUBLICATION_OUTCOME_INVALID",
    }),
    repositoryDisclosurePolicy,
    visibility,
    claims: input.claims,
  };
}

function publicationFields(normalized: ReturnType<typeof normalizeDraftInput>) {
  return {
    slug: normalized.slug,
    internalTitle: normalized.internalTitle,
    title: normalized.title,
    summary: normalized.summary,
    roleText: normalized.roleText,
    projectPeriodText: normalized.projectPeriodText,
    technologyLabels: normalized.technologyLabels,
    problemText: normalized.problemText,
    approachText: normalized.approachText,
    outcomeText: normalized.outcomeText,
    repositoryDisclosurePolicy: normalized.repositoryDisclosurePolicy,
    visibility: normalized.visibility,
  };
}

function validateRepositoryDisclosure(
  policy: "PUBLIC_REPOSITORY" | "IDENTITY_REDACTED",
  repositoryVisibility: string,
) {
  if (
    policy === "PUBLIC_REPOSITORY" &&
    repositoryVisibility.toLowerCase() !== "public"
  )
    throw new PublishingError("PRIVATE_REPOSITORY_IDENTITY_REDACTION_REQUIRED");
}

function validatePrivateDraftPrivacy(
  draft: Pick<
    ProjectPublication,
    | "title"
    | "summary"
    | "roleText"
    | "projectPeriodText"
    | "technologyLabels"
    | "problemText"
    | "approachText"
    | "outcomeText"
  >,
  eligibility: EligibilityResult,
) {
  if (!eligibility.includesPrivateSource) return;
  assertNoPrivateSourceIdentifiers(
    [
      draft.title,
      draft.summary,
      draft.roleText,
      draft.projectPeriodText,
      ...draft.technologyLabels,
      draft.problemText,
      draft.approachText,
      draft.outcomeText,
    ],
    eligibility.privateForbiddenValues,
  );
}

function validatePublishConfirmation(input: PublishConfirmation) {
  if (input.confirmation !== "PUBLISH")
    throw new PublishingError("PUBLISH_CONFIRMATION_REQUIRED");
  if (input.publicDisclosureAcknowledged !== true)
    throw new PublishingError("PUBLIC_DISCLOSURE_ACKNOWLEDGEMENT_REQUIRED");
  return {
    expectedVersion: validExpectedVersion(input.expectedVersion),
    privateSourceAcknowledged: input.privateSourceAcknowledged === true,
    idempotencyKey: normalizePlainText(input.idempotencyKey, {
      min: 16,
      max: 100,
      code: "PUBLISH_IDEMPOTENCY_KEY_INVALID",
    }),
  };
}

function revisionFields(view: PublicProjectView) {
  return {
    title: view.title,
    summary: view.summary,
    roleText: view.role,
    projectPeriodText: view.period,
    technologyLabels: view.technologies,
    problemText: view.problem,
    approachText: view.approach,
    outcomeText: view.outcome,
    publicRepositoryLabel: view.publicRepositoryLabel,
    publicRepositoryUrl: view.publicRepositoryUrl,
    authorSlug: view.author.slug,
    authorDisplayName: view.author.displayName,
    authorHeadline: view.author.headline,
    authorBiography: view.author.biography,
    authorLocationText: view.author.location,
    authorPersonalWebsiteUrl: view.author.personalWebsiteUrl,
    authorGithubProfileUrl: view.author.githubProfileUrl,
  };
}

async function lockPublication(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  publicationId: string,
) {
  await tx.$executeRaw`
    SELECT "id"
    FROM "ProjectPublication"
    WHERE "id" = ${publicationId} AND "workspaceId" = ${workspaceId}
    FOR UPDATE
  `;
}

async function enforcePublishLimits(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  await enforceOperationLimit(tx, workspaceId);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const revisions = await tx.projectPublicationRevision.count({
    where: {
      publication: { workspaceId },
      createdAt: { gte: since },
    },
  });
  if (revisions >= 20)
    throw new PublishingError("PUBLICATION_REVISION_RATE_LIMIT");
}

async function enforceOperationLimit(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const operations = await tx.publicationEvent.count({
    where: {
      workspaceId,
      createdAt: { gte: since },
      kind: {
        in: ["PUBLISHED", "REVISION_PUBLISHED", "REPUBLISHED", "UNPUBLISHED"],
      },
    },
  });
  if (operations >= 10)
    throw new PublishingError("PUBLICATION_OPERATION_RATE_LIMIT");
}

async function writePublicationEvent(
  tx: Prisma.TransactionClient,
  authority: PublishingAuthority,
  publicationId: string,
  kind: PublicationEventKind,
  safeMetadata?: Prisma.InputJsonValue,
) {
  await tx.publicationEvent.create({
    data: {
      workspaceId: authority.workspaceId,
      publicationId,
      actorUserId: authority.userId,
      kind,
      safeMetadata,
    },
  });
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  authority: PublishingAuthority,
  publicationId: string,
  type: string,
) {
  await tx.auditEvent.create({
    data: {
      workspaceId: authority.workspaceId,
      userId: authority.userId,
      type,
      metadata: { publicationId },
    },
  });
}
