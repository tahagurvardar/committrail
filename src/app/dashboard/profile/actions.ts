"use server";

import { revalidatePath } from "next/cache";
import { savePublicProfile } from "@/lib/publishing/profile-service";

export async function savePublicProfileAction(formData: FormData) {
  await savePublicProfile({
    slug: formData.get("slug"),
    displayName: formData.get("displayName"),
    headline: formData.get("headline"),
    biography: formData.get("biography"),
    locationText: formData.get("locationText"),
    personalWebsiteUrl: formData.get("personalWebsiteUrl"),
    githubProfileUrl: formData.get("githubProfileUrl"),
    visibility: formData.get("visibility"),
    expectedVersion: formData.get("expectedVersion") ?? undefined,
  });
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/publications");
}
