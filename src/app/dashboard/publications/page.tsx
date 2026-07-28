import Link from "next/link";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicationsPage() {
  const { workspace } = await requireWorkspaceOwner();
  const [profile, publications] = await Promise.all([
    getPrisma().publicProfile.findUnique({
      where: { workspaceId: workspace.id },
    }),
    getPrisma().projectPublication.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
      include: { trackedRepository: { select: { fullName: true } } },
    }),
  ]);
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Project publications</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Private drafts become public only through typed confirmation and a
            new immutable revision. Editing never changes an existing public
            revision.
          </p>
        </div>
        <Link
          href="/dashboard/publications/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New publication draft
        </Link>
      </div>
      {!profile ? (
        <p className="mt-6 rounded-xl border p-4 text-sm">
          Configure a{" "}
          <Link href="/dashboard/profile" className="text-primary underline">
            public profile
          </Link>{" "}
          before creating a publication.
        </p>
      ) : null}
      {publications.length ? (
        <ul className="mt-8 space-y-4">
          {publications.map((publication) => (
            <li key={publication.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{publication.internalTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {publication.trackedRepository.fullName} ·{" "}
                    {publication.status} · {publication.visibility}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Health: {publication.healthState} · revision{" "}
                    {publication.version}
                  </p>
                </div>
                <Link
                  href={`/dashboard/publications/${publication.id}`}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  Review draft
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          No publication drafts yet. Nothing is published automatically.
        </p>
      )}
    </section>
  );
}
