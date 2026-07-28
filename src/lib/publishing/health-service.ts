import "server-only";

import type { Prisma, PublicationHealthState } from "@/generated/prisma/client";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { invalidatePublicProfile, invalidatePublicProject } from "./cache";
import { PublishingError } from "./errors";
import { contentHash } from "./hash";
import type { PublishingAuthority } from "./profile-service";

export async function refreshPublicationHealth(publicationId: string) {
  const { workspace, session } = await requireWorkspaceOwner();
  return refreshPublicationHealthForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    publicationId,
  );
}

export async function refreshPublicationHealthForAuthority(
  authority: PublishingAuthority,
  publicationId: string,
) {
  const result = await getPrisma().$transaction(async (tx) => {
    const publication = await tx.projectPublication.findFirst({
      where: { id: publicationId, workspaceId: authority.workspaceId },
      include: {
        profile: { select: { slug: true } },
        trackedRepository: { select: { trackingStatus: true } },
        currentPublishedRevision: {
          include: {
            claimSnapshots: {
              include: {
                sourceClaim: { select: { statement: true, status: true } },
                evidenceSnapshots: {
                  include: {
                    sourceRepositoryEvidence: {
                      select: {
                        normalizedContentHash: true,
                        sourceAvailability: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!publication) throw new PublishingError("PUBLICATION_NOT_FOUND");
    const health = calculateHealth(publication);
    const privateSourceUnavailable =
      health === "SOURCE_UNAVAILABLE" &&
      publication.currentPublishedRevision?.claimSnapshots.some((claim) =>
        claim.evidenceSnapshots.some(
          (evidence) => evidence.disclosureMode === "PRIVATE_SOURCE_REDACTED",
        ),
      );
    const automaticallyUnpublished =
      Boolean(privateSourceUnavailable) && publication.status === "PUBLISHED";
    await tx.projectPublication.update({
      where: { id: publication.id },
      data: {
        healthState: health,
        healthCheckedAt: new Date(),
        status: automaticallyUnpublished ? "UNPUBLISHED" : publication.status,
        unpublishedAt: automaticallyUnpublished
          ? new Date()
          : publication.unpublishedAt,
        version:
          health !== publication.healthState || automaticallyUnpublished
            ? { increment: 1 }
            : undefined,
      },
    });
    if (health !== publication.healthState) {
      await tx.publicationEvent.create({
        data: {
          workspaceId: authority.workspaceId,
          publicationId: publication.id,
          actorUserId: authority.userId,
          kind: "EVIDENCE_BECAME_STALE",
          safeMetadata: { health, automaticallyUnpublished },
        },
      });
    }
    return {
      health,
      automaticallyUnpublished,
      projectSlug: publication.slug,
      profileSlug: publication.profile.slug,
    };
  });
  invalidatePublicProject(result.projectSlug);
  invalidatePublicProfile(result.profileSlug);
  return result;
}

export async function prepareRepositoryPublicationRemoval(
  tx: Prisma.TransactionClient,
  authority: Pick<PublishingAuthority, "workspaceId"> & { userId?: string },
  trackedRepositoryIds: string[],
) {
  const publications = await tx.projectPublication.findMany({
    where: {
      workspaceId: authority.workspaceId,
      trackedRepositoryId: { in: trackedRepositoryIds },
    },
    include: { profile: { select: { slug: true } } },
  });
  const published = publications.filter(
    (publication) => publication.status === "PUBLISHED",
  );
  if (published.length) {
    await tx.projectPublication.updateMany({
      where: { id: { in: published.map((publication) => publication.id) } },
      data: {
        status: "UNPUBLISHED",
        healthState: "SOURCE_UNAVAILABLE",
        healthCheckedAt: new Date(),
        unpublishedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await tx.publicationEvent.createMany({
      data: published.map((publication) => ({
        workspaceId: authority.workspaceId,
        publicationId: publication.id,
        actorUserId: authority.userId,
        kind: "REPOSITORY_DISCONNECTED",
      })),
    });
  }
  return {
    projectSlugs: publications.map((publication) => publication.slug),
    profileSlugs: [
      ...new Set(publications.map((publication) => publication.profile.slug)),
    ],
  };
}

export async function markPublicationEvidenceUnavailable(
  tx: Prisma.TransactionClient,
  repositoryEvidenceIds: string[],
  observedAt = new Date(),
) {
  if (!repositoryEvidenceIds.length) return;
  const publications = await tx.projectPublication.findMany({
    where: {
      status: "PUBLISHED",
      currentPublishedRevision: {
        evidenceSnapshots: {
          some: {
            sourceRepositoryEvidenceId: { in: repositoryEvidenceIds },
          },
        },
      },
    },
    select: {
      id: true,
      workspaceId: true,
      currentPublishedRevision: {
        select: {
          evidenceSnapshots: {
            where: {
              sourceRepositoryEvidenceId: { in: repositoryEvidenceIds },
            },
            select: { disclosureMode: true },
          },
        },
      },
    },
  });
  for (const publication of publications) {
    const automaticallyUnpublished =
      publication.currentPublishedRevision?.evidenceSnapshots.some(
        (evidence) => evidence.disclosureMode === "PRIVATE_SOURCE_REDACTED",
      ) ?? false;
    await tx.projectPublication.update({
      where: { id: publication.id },
      data: {
        healthState: "SOURCE_UNAVAILABLE",
        healthCheckedAt: observedAt,
        status: automaticallyUnpublished ? "UNPUBLISHED" : "PUBLISHED",
        unpublishedAt: automaticallyUnpublished ? observedAt : undefined,
        version: { increment: 1 },
      },
    });
    await tx.publicationEvent.create({
      data: {
        workspaceId: publication.workspaceId,
        publicationId: publication.id,
        kind: "EVIDENCE_BECAME_STALE",
        safeMetadata: {
          health: "SOURCE_UNAVAILABLE",
          automaticallyUnpublished,
        },
      },
    });
  }
}

export function invalidatePublicationRemoval(input: {
  projectSlugs: string[];
  profileSlugs: string[];
}) {
  for (const slug of input.projectSlugs) invalidatePublicProject(slug);
  for (const slug of input.profileSlugs) invalidatePublicProfile(slug);
}

function calculateHealth(publication: {
  trackedRepository: { trackingStatus: string };
  currentPublishedRevision: {
    claimSnapshots: Array<{
      statementHash: string;
      sourceClaim: { statement: string; status: string };
      evidenceSnapshots: Array<{
        sourceContentHash: string;
        sourceRepositoryEvidence: {
          normalizedContentHash: string;
          sourceAvailability: string;
        };
      }>;
    }>;
  } | null;
}): PublicationHealthState {
  if (
    publication.trackedRepository.trackingStatus !== "ACTIVE" ||
    !publication.currentPublishedRevision
  )
    return "SOURCE_UNAVAILABLE";
  let reviewRequired = false;
  for (const claim of publication.currentPublishedRevision.claimSnapshots) {
    if (
      claim.sourceClaim.status !== "VERIFIED" ||
      claim.statementHash !== contentHash(claim.sourceClaim.statement)
    )
      reviewRequired = true;
    for (const evidence of claim.evidenceSnapshots) {
      if (evidence.sourceRepositoryEvidence.sourceAvailability !== "AVAILABLE")
        return "SOURCE_UNAVAILABLE";
      if (
        evidence.sourceContentHash !==
        evidence.sourceRepositoryEvidence.normalizedContentHash
      )
        reviewRequired = true;
    }
  }
  return reviewRequired ? "REVIEW_REQUIRED" : "CURRENT";
}
