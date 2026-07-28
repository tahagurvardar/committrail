import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function profileCacheTag(slug: string): string {
  if (!SAFE_SLUG.test(slug)) throw new Error("CACHE_TAG_INVALID");
  return `public-profile:${slug}`;
}

export function projectCacheTag(slug: string): string {
  if (!SAFE_SLUG.test(slug)) throw new Error("CACHE_TAG_INVALID");
  return `public-project:${slug}`;
}

export function invalidatePublicProfile(slug: string): void {
  revalidateTag(profileCacheTag(slug), "max");
  revalidatePath(`/profiles/${slug}`);
  revalidatePath("/sitemap.xml");
}

export function invalidatePublicProject(slug: string): void {
  revalidateTag(projectCacheTag(slug), "max");
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/sitemap.xml");
}
