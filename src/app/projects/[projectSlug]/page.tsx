import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicProject } from "@/components/publishing/public-project";
import { getPublicPublicationBySlug } from "@/lib/publishing/publication-service";
import { configuredPublicAppUrl } from "@/lib/publishing/public-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}): Promise<Metadata> {
  const { projectSlug } = await params;
  const project = await getPublicPublicationBySlug(projectSlug);
  if (!project) return { title: "Project not found", robots: { index: false } };
  const appUrl = configuredPublicAppUrl();
  return {
    title: project.title,
    description: project.summary.slice(0, 160),
    authors: [{ name: project.author.displayName }],
    alternates: appUrl
      ? { canonical: `${appUrl}/projects/${project.slug}` }
      : undefined,
    robots:
      project.visibility === "PUBLIC"
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function PublicProjectPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const project = await getPublicPublicationBySlug(projectSlug);
  if (!project) notFound();
  return <PublicProject project={project} />;
}
