import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { configuredPublicAppUrl } from "@/lib/publishing/public-url";
import { getPublicProfileBySlug } from "@/lib/publishing/profile-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileSlug: string }>;
}): Promise<Metadata> {
  const { profileSlug } = await params;
  const profile = await getPublicProfileBySlug(profileSlug);
  if (!profile) return { title: "Profile not found", robots: { index: false } };
  const appUrl = configuredPublicAppUrl();
  return {
    title: profile.displayName,
    description: profile.biography.slice(0, 160),
    alternates: appUrl
      ? { canonical: `${appUrl}/profiles/${profile.slug}` }
      : undefined,
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ profileSlug: string }>;
}) {
  const { profileSlug } = await params;
  const profile = await getPublicProfileBySlug(profileSlug);
  if (!profile) notFound();
  return (
    <article className="container-page py-10">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">
          Evidence-backed public profile
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {profile.displayName}
        </h1>
        <p className="mt-3 text-xl">{profile.headline}</p>
        <p className="mt-5 whitespace-pre-wrap text-muted-foreground">
          {profile.biography}
        </p>
        {profile.location ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {profile.location}
          </p>
        ) : null}
        <ul className="mt-5 flex flex-wrap gap-4 text-sm">
          {profile.personalWebsiteUrl ? (
            <li>
              <a
                href={profile.personalWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Personal website
              </a>
            </li>
          ) : null}
          {profile.githubProfileUrl ? (
            <li>
              <a
                href={profile.githubProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                GitHub profile
              </a>
            </li>
          ) : null}
        </ul>
      </header>
      <section className="mt-10" aria-labelledby="published-projects">
        <h2 id="published-projects" className="text-2xl font-semibold">
          Published projects
        </h2>
        {profile.projects.length ? (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {profile.projects.map((project) => (
              <li key={project.slug} className="rounded-xl border bg-card p-5">
                <h3 className="text-lg font-semibold">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="hover:text-primary"
                  >
                    {project.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {project.summary}
                </p>
                <time
                  dateTime={project.publishedAt}
                  className="mt-3 block text-xs text-muted-foreground"
                >
                  Updated {new Date(project.publishedAt).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No PUBLIC projects are currently listed. UNLISTED projects never
            appear here.
          </p>
        )}
      </section>
      <footer className="mt-10 border-t pt-6 text-sm text-muted-foreground">
        CommitTrail shows author-reviewed claims and disclosed provenance. It
        does not independently certify the claims.
      </footer>
    </article>
  );
}
