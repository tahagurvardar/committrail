import type { MetadataRoute } from "next";
import { isPublicDemo } from "@/lib/config/app-mode";
import { getPrisma } from "@/lib/db/prisma";
import { configuredPublicAppUrl } from "@/lib/publishing/public-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = configuredPublicAppUrl();
  if (!appUrl) return [];
  if (isPublicDemo()) {
    return ["/", "/about", "/methodology", "/demo"].map((pathname) => ({
      url: `${appUrl}${pathname}`,
    }));
  }
  const [profiles, publications] = await Promise.all([
    getPrisma().publicProfile.findMany({
      where: { visibility: "PUBLIC" },
      select: { slug: true, updatedAt: true },
    }),
    getPrisma().projectPublication.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        profile: { visibility: "PUBLIC" },
        trackedRepository: { trackingStatus: "ACTIVE" },
        currentPublishedRevisionId: { not: null },
      },
      select: { slug: true, latestPublishedAt: true },
    }),
  ]);
  return [
    ...profiles.map((profile) => ({
      url: `${appUrl}/profiles/${profile.slug}`,
      lastModified: profile.updatedAt,
    })),
    ...publications.map((publication) => ({
      url: `${appUrl}/projects/${publication.slug}`,
      lastModified: publication.latestPublishedAt ?? undefined,
    })),
  ];
}
