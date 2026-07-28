import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
  archivePublicationAction,
  publishPublicationAction,
  refreshPublicationHealthAction,
  restorePublicationAction,
  unpublishPublicationAction,
  updatePublicationAction,
} from "../actions";
import { PublicationEditor } from "../publication-editor";
import { getAuthorizedPublication } from "@/lib/publishing/publication-service";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ publicationId: string }>;
}) {
  const { publicationId } = await params;
  const { publication, workspace } =
    await getAuthorizedPublication(publicationId);
  const repositories = await editorRepositories(workspace.id);
  const selections = new Map(
    publication.claimSelections.map((selection) => [
      selection.claimId,
      {
        position: selection.position,
        evidence: new Map(
          selection.evidenceDisclosures.map((disclosure) => [
            disclosure.repositoryEvidenceId,
            {
              mode: disclosure.mode,
              publicTitle: disclosure.publicTitle,
              includeOccurredAt: disclosure.includeOccurredAt,
            },
          ]),
        ),
      },
    ]),
  );
  const privateRepository =
    repositories.find(
      (repository) => repository.id === publication.trackedRepositoryId,
    )?.visibility !== "public";
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/publications"
            className="text-sm text-primary underline"
          >
            Back to publications
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">
            {publication.internalTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {publication.status} · {publication.visibility} · health{" "}
            {publication.healthState} · optimistic version {publication.version}
          </p>
        </div>
        <nav aria-label="Publication review" className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/publications/${publication.id}/preview`}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Exact preview
          </Link>
          <Link
            href={`/dashboard/publications/${publication.id}/history`}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Revision history
          </Link>
          {publication.status === "PUBLISHED" ? (
            <Link
              href={`/projects/${publication.slug}`}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Public route
            </Link>
          ) : null}
        </nav>
      </div>

      {publication.healthState !== "CURRENT" ? (
        <aside className="mt-6 rounded-xl border p-4 text-sm" role="status">
          This publication needs source review: {publication.healthState}. Its
          immutable public wording has not been silently changed.
        </aside>
      ) : null}

      {publication.status !== "ARCHIVED" ? (
        <form action={updatePublicationAction} className="mt-8">
          <input type="hidden" name="publicationId" value={publication.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={publication.version}
          />
          <PublicationEditor
            repositories={repositories}
            defaults={{
              trackedRepositoryId: publication.trackedRepositoryId,
              slug: publication.slug,
              internalTitle: publication.internalTitle,
              title: publication.title,
              summary: publication.summary,
              roleText: publication.roleText,
              projectPeriodText: publication.projectPeriodText,
              technologyLabels: publication.technologyLabels,
              problemText: publication.problemText,
              approachText: publication.approachText,
              outcomeText: publication.outcomeText,
              repositoryDisclosurePolicy:
                publication.repositoryDisclosurePolicy,
              visibility: publication.visibility,
              firstPublishedAt: publication.firstPublishedAt,
              selections,
            }}
          />
          <button className="mt-6 rounded-md border px-4 py-2 text-sm font-medium">
            Save private changes
          </button>
        </form>
      ) : null}

      <section className="mt-10 rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Publishing ceremony</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Profile: {publication.profile.displayName} · final URL: /projects/
          {publication.slug} · visibility: {publication.visibility}. Publishing
          creates an immutable revision. PUBLIC may be indexed; UNLISTED remains
          accessible to anyone with its URL.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          <li>{publication.claimSelections.length} selected verified claims</li>
          <li>
            {publication.claimSelections.reduce(
              (count, claim) => count + claim.evidenceDisclosures.length,
              0,
            )}{" "}
            explicit evidence disclosures
          </li>
          <li>
            AI-assisted claims retain a visible author-reviewed disclosure.
          </li>
          <li>
            Private evidence exposes no repository identity, URL, SHA, branch,
            source number, or internal identifier.
          </li>
        </ul>
        {publication.status !== "ARCHIVED" ? (
          <form action={publishPublicationAction} className="mt-5 space-y-3">
            <input type="hidden" name="publicationId" value={publication.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={publication.version}
            />
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="publicDisclosureAcknowledged"
                value="accepted"
                required
                className="mt-1"
              />
              I reviewed the exact public preview, links, visibility, claims,
              and evidence disclosures.
            </label>
            {privateRepository ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="privateSourceAcknowledged"
                  value="accepted"
                  required
                  className="mt-1"
                />
                I explicitly approve the private-source redacted disclosures and
                understand they are not publicly verifiable.
              </label>
            ) : null}
            <label
              className="block max-w-sm text-sm"
              htmlFor="publish-confirmation"
            >
              Type PUBLISH
              <input
                id="publish-confirmation"
                name="confirmation"
                required
                pattern="PUBLISH"
                autoComplete="off"
                className="mt-2 w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Publish immutable revision
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm">Restore this draft before publishing.</p>
        )}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {publication.status === "PUBLISHED" ? (
          <form
            action={unpublishPublicationAction}
            className="rounded-xl border p-4"
          >
            <h2 className="font-semibold">Unpublish immediately</h2>
            <input type="hidden" name="publicationId" value={publication.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={publication.version}
            />
            <label
              className="mt-3 block text-sm"
              htmlFor="unpublish-confirmation"
            >
              Type UNPUBLISH
              <input
                id="unpublish-confirmation"
                name="confirmation"
                pattern="UNPUBLISH"
                required
                className="mt-2 w-full rounded border bg-background px-2 py-2"
              />
            </label>
            <button className="mt-3 rounded border px-3 py-2 text-sm">
              Unpublish
            </button>
          </form>
        ) : null}
        {publication.status !== "ARCHIVED" ? (
          <form
            action={archivePublicationAction}
            className="rounded-xl border p-4"
          >
            <h2 className="font-semibold">Archive private draft</h2>
            <input type="hidden" name="publicationId" value={publication.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={publication.version}
            />
            <label
              className="mt-3 block text-sm"
              htmlFor="archive-confirmation"
            >
              Type ARCHIVE
              <input
                id="archive-confirmation"
                name="confirmation"
                pattern="ARCHIVE"
                required
                className="mt-2 w-full rounded border bg-background px-2 py-2"
              />
            </label>
            <button className="mt-3 rounded border px-3 py-2 text-sm">
              Archive
            </button>
          </form>
        ) : (
          <form
            action={restorePublicationAction}
            className="rounded-xl border p-4"
          >
            <h2 className="font-semibold">Restore draft</h2>
            <input type="hidden" name="publicationId" value={publication.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={publication.version}
            />
            <button className="mt-3 rounded border px-3 py-2 text-sm">
              Restore to private review
            </button>
          </form>
        )}
        <form
          action={refreshPublicationHealthAction}
          className="rounded-xl border p-4"
        >
          <h2 className="font-semibold">Publication health</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Mechanical source comparison only, never a truth or quality score.
          </p>
          <input type="hidden" name="publicationId" value={publication.id} />
          <button className="mt-3 rounded border px-3 py-2 text-sm">
            Recheck source health
          </button>
        </form>
      </section>
    </section>
  );
}

async function editorRepositories(workspaceId: string) {
  const repositories = await getPrisma().trackedRepository.findMany({
    where: { workspaceId, trackingStatus: "ACTIVE" },
    orderBy: { fullName: "asc" },
    include: {
      evidenceClaims: {
        where: { status: "VERIFIED", verifiedAt: { not: null } },
        include: {
          evidenceLinks: {
            where: { repositoryEvidence: { sourceAvailability: "AVAILABLE" } },
            include: { repositoryEvidence: true },
          },
        },
      },
    },
  });
  return repositories.map((repository) => ({
    id: repository.id,
    fullName: repository.fullName,
    visibility: repository.visibility,
    claims: repository.evidenceClaims
      .filter((claim) => claim.evidenceLinks.length)
      .map((claim) => ({
        id: claim.id,
        statement: claim.statement,
        origin: claim.origin,
        evidence: claim.evidenceLinks.map(({ repositoryEvidence }) => ({
          id: repositoryEvidence.id,
          title: repositoryEvidence.title,
          evidenceType: repositoryEvidence.evidenceType,
          occurredAt: repositoryEvidence.occurredAt.toISOString(),
        })),
      })),
  }));
}
