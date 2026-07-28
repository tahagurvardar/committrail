import type { MetadataRoute } from "next";
import { configuredPublicAppUrl } from "@/lib/publishing/public-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = configuredPublicAppUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/profiles/", "/projects/"],
      disallow: [
        "/api/",
        "/dashboard/",
        "/login",
        "/register",
        "/account-deleted",
      ],
    },
    sitemap: appUrl ? `${appUrl}/sitemap.xml` : undefined,
  };
}
