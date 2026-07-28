import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { invalidatePublicProfile, invalidatePublicProject } from "./cache";
import { PublishingError } from "./errors";
import {
  normalizeOptionalPlainText,
  normalizePlainText,
  normalizePublicSlug,
  normalizePublicUrl,
  validExpectedVersion,
} from "./validation";

export interface PublishingAuthority {
  workspaceId: string;
  userId: string;
}

export interface PublicProfileInput {
  slug: unknown;
  displayName: unknown;
  headline: unknown;
  biography: unknown;
  locationText?: unknown;
  personalWebsiteUrl?: unknown;
  githubProfileUrl?: unknown;
  visibility: unknown;
  expectedVersion?: unknown;
}

export async function getAuthorizedPublicProfile() {
  const { workspace, session } = await requireWorkspaceOwner();
  const profile = await getPrisma().publicProfile.findFirst({
    where: { workspaceId: workspace.id },
  });
  return { profile, workspace, session };
}

export async function savePublicProfile(input: PublicProfileInput) {
  const { workspace, session } = await requireWorkspaceOwner();
  return savePublicProfileForAuthority(
    { workspaceId: workspace.id, userId: session.user.id },
    input,
  );
}

export async function savePublicProfileForAuthority(
  authority: PublishingAuthority,
  input: PublicProfileInput,
) {
  const normalized = normalizeProfileInput(input);
  const prisma = getPrisma();
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`profile:${authority.workspaceId}`}))`;
      const workspace = await tx.workspace.findFirst({
        where: { id: authority.workspaceId, ownerUserId: authority.userId },
        select: { id: true },
      });
      if (!workspace) throw new PublishingError("PROFILE_NOT_FOUND");
      const existing = await tx.publicProfile.findUnique({
        where: { workspaceId: authority.workspaceId },
      });
      if (existing) {
        const expectedVersion = validExpectedVersion(input.expectedVersion);
        if (existing.version !== expectedVersion)
          throw new PublishingError("PROFILE_VERSION_CONFLICT");
        if (existing.firstPublishedAt && existing.slug !== normalized.slug)
          throw new PublishingError("PROFILE_SLUG_IMMUTABLE");
        if (existing.slug !== normalized.slug)
          await reserveSlug(
            tx,
            authority.workspaceId,
            normalized.slug,
            "PROFILE",
          );
        const updated = await tx.publicProfile.update({
          where: { id: existing.id },
          data: {
            ...normalized,
            firstPublishedAt:
              normalized.visibility === "PUBLIC"
                ? (existing.firstPublishedAt ?? new Date())
                : existing.firstPublishedAt,
            latestPublishedAt:
              normalized.visibility === "PUBLIC"
                ? new Date()
                : existing.latestPublishedAt,
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId: authority.workspaceId,
            userId: authority.userId,
            type: "public_profile.updated",
            metadata: { visibility: normalized.visibility },
          },
        });
        if (
          existing.visibility === "PUBLIC" &&
          normalized.visibility === "PRIVATE"
        ) {
          const publications = await tx.projectPublication.findMany({
            where: { workspaceId: authority.workspaceId, status: "PUBLISHED" },
            select: { id: true, slug: true },
          });
          if (publications.length) {
            await tx.publicationEvent.createMany({
              data: publications.map((publication) => ({
                workspaceId: authority.workspaceId,
                publicationId: publication.id,
                actorUserId: authority.userId,
                kind: "PROFILE_HIDDEN",
              })),
            });
          }
          return {
            profile: updated,
            invalidatedProjectSlugs: publications.map((p) => p.slug),
          };
        }
        return { profile: updated, invalidatedProjectSlugs: [] };
      }
      await reserveSlug(tx, authority.workspaceId, normalized.slug, "PROFILE");
      const profile = await tx.publicProfile.create({
        data: {
          workspaceId: authority.workspaceId,
          ...normalized,
          firstPublishedAt:
            normalized.visibility === "PUBLIC" ? new Date() : null,
          latestPublishedAt:
            normalized.visibility === "PUBLIC" ? new Date() : null,
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: authority.workspaceId,
          userId: authority.userId,
          type: "public_profile.created",
        },
      });
      return { profile, invalidatedProjectSlugs: [] };
    },
    { isolationLevel: "Serializable" },
  );
  invalidatePublicProfile(result.profile.slug);
  for (const slug of result.invalidatedProjectSlugs)
    invalidatePublicProject(slug);
  return result.profile;
}

export async function getPublicProfileBySlug(slugInput: string) {
  let slug: string;
  try {
    slug = normalizePublicSlug(slugInput, "PROFILE");
  } catch {
    return null;
  }
  const profile = await getPrisma().publicProfile.findFirst({
    where: { slug, visibility: "PUBLIC" },
    include: {
      publications: {
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          currentPublishedRevisionId: { not: null },
          trackedRepository: { trackingStatus: "ACTIVE" },
        },
        orderBy: { latestPublishedAt: "desc" },
        select: {
          slug: true,
          latestPublishedAt: true,
          currentPublishedRevision: {
            select: { title: true, summary: true, publishedAt: true },
          },
        },
      },
    },
  });
  if (!profile) return null;
  return {
    slug: profile.slug,
    displayName: profile.displayName,
    headline: profile.headline,
    biography: profile.biography,
    location: profile.locationText,
    personalWebsiteUrl: profile.personalWebsiteUrl,
    githubProfileUrl: profile.githubProfileUrl,
    projects: profile.publications.flatMap((publication) =>
      publication.currentPublishedRevision
        ? [
            {
              slug: publication.slug,
              title: publication.currentPublishedRevision.title,
              summary: publication.currentPublishedRevision.summary,
              publishedAt:
                publication.latestPublishedAt?.toISOString() ??
                publication.currentPublishedRevision.publishedAt.toISOString(),
            },
          ]
        : [],
    ),
  };
}

function normalizeProfileInput(input: PublicProfileInput) {
  const visibility =
    input.visibility === "PUBLIC"
      ? ("PUBLIC" as const)
      : input.visibility === "PRIVATE"
        ? ("PRIVATE" as const)
        : null;
  if (!visibility) throw new PublishingError("PROFILE_VISIBILITY_INVALID");
  const githubProfileUrl = normalizePublicUrl(
    input.githubProfileUrl,
    "GITHUB_PROFILE_URL_INVALID",
  );
  if (githubProfileUrl && new URL(githubProfileUrl).hostname !== "github.com")
    throw new PublishingError("GITHUB_PROFILE_URL_INVALID");
  return {
    slug: normalizePublicSlug(input.slug, "PROFILE"),
    displayName: normalizePlainText(input.displayName, {
      min: 1,
      max: 80,
      code: "PROFILE_DISPLAY_NAME_INVALID",
    }),
    headline: normalizePlainText(input.headline, {
      min: 1,
      max: 140,
      code: "PROFILE_HEADLINE_INVALID",
    }),
    biography: normalizePlainText(input.biography, {
      min: 1,
      max: 600,
      code: "PROFILE_BIOGRAPHY_INVALID",
    }),
    locationText: normalizeOptionalPlainText(input.locationText, {
      max: 100,
      code: "PROFILE_LOCATION_INVALID",
    }),
    personalWebsiteUrl: normalizePublicUrl(input.personalWebsiteUrl),
    githubProfileUrl,
    visibility,
  };
}

export async function reserveSlug(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  slug: string,
  kind: "PROFILE" | "PROJECT",
) {
  const existing = await tx.publicSlugReservation.findUnique({
    where: { slug },
  });
  const workspaceHash = createHash("sha256").update(workspaceId).digest("hex");
  if (existing) {
    if (
      existing.kind !== kind ||
      existing.reservedByWorkspaceHash !== workspaceHash
    )
      throw new PublishingError("PUBLIC_SLUG_UNAVAILABLE");
    return existing;
  }
  return tx.publicSlugReservation.create({
    data: {
      slug,
      kind,
      reservedByWorkspaceHash: workspaceHash,
    },
  });
}
