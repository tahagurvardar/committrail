import Link from "next/link";
import { getAuthorizedPublication } from "@/lib/publishing/publication-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicationHistoryPage({
  params,
}: {
  params: Promise<{ publicationId: string }>;
}) {
  const { publicationId } = await params;
  const { publication } = await getAuthorizedPublication(publicationId);
  return (
    <section>
      <Link
        href={`/dashboard/publications/${publication.id}`}
        className="text-sm text-primary underline"
      >
        Back to publication
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">
        Immutable revision history
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Earlier revisions are never rewritten when the private draft changes.
      </p>
      <ol className="mt-8 space-y-4">
        {[...publication.revisions].reverse().map((revision) => (
          <li key={revision.id} className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">
              Revision {revision.revisionNumber}: {revision.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Published{" "}
              <time dateTime={revision.publishedAt.toISOString()}>
                {revision.publishedAt.toLocaleString()}
              </time>{" "}
              · {revision.visibility}
            </p>
            <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
              Content hash: {revision.contentHash}
            </p>
            {revision.supersededAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Superseded{" "}
                <time dateTime={revision.supersededAt.toISOString()}>
                  {revision.supersededAt.toLocaleString()}
                </time>
              </p>
            ) : (
              <p className="mt-2 text-xs">Current immutable revision</p>
            )}
          </li>
        ))}
      </ol>
      <h2 className="mt-10 text-2xl font-semibold">Lifecycle events</h2>
      <ol className="mt-5 space-y-2">
        {[...publication.events].reverse().map((event) => (
          <li key={event.id} className="rounded-md border p-3 text-sm">
            {event.kind} ·{" "}
            <time dateTime={event.createdAt.toISOString()}>
              {event.createdAt.toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
