import { notFound } from "next/navigation";
import Link from "next/link";
import {
  claimStatusAction,
  editClaimAction,
  linkEvidenceAction,
  unlinkEvidenceAction,
} from "@/app/dashboard/repositories/[trackedRepositoryId]/claims/actions";
import { ClaimEvidenceGraph } from "@/components/claims/claim-evidence-graph";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { safeGitHubSourceUrl } from "@/lib/evidence/safe-source-url";

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ trackedRepositoryId: string; claimId: string }>;
}) {
  const { trackedRepositoryId, claimId } = await params;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  const claim = await getPrisma().evidenceClaim.findFirst({
    where: {
      id: claimId,
      trackedRepositoryId: repository.id,
      workspaceId: repository.workspaceId,
    },
    include: {
      author: { select: { name: true } },
      evidenceLinks: {
        orderBy: { createdAt: "asc" },
        include: {
          repositoryEvidence: {
            include: {
              observations: {
                orderBy: { observedAt: "desc" },
                take: 5,
              },
            },
          },
        },
      },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });
  if (!claim) notFound();
  const linkedIds = new Set(
    claim.evidenceLinks.map((link) => link.repositoryEvidenceId),
  );
  const availableEvidence = await getPrisma().repositoryEvidence.findMany({
    where: {
      trackedRepositoryId: repository.id,
      id: { notIn: [...linkedIds] },
      sourceAvailability: "AVAILABLE",
    },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });
  const archived = claim.status === "ARCHIVED";
  return (
    <section>
      <Link
        href={`/dashboard/repositories/${repository.id}/claims`}
        className="text-sm text-primary underline"
      >
        Back to claims
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-primary">Owner-reviewed claim</p>
          <h1 className="mt-1 text-3xl font-semibold">{claim.statement}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {claim.status} · version {claim.version} · author{" "}
            {claim.author.name}
          </p>
        </div>
        <form action={claimStatusAction}>
          <ClaimFields
            repositoryId={repository.id}
            claimId={claim.id}
            version={claim.version}
          />
          <input
            type="hidden"
            name="operation"
            value={archived ? "restore" : "archive"}
          />
          <button className="rounded-md border px-3 py-2 text-sm">
            {archived ? "Restore claim" : "Archive claim"}
          </button>
        </form>
      </div>
      <aside className="mt-6 rounded-xl border border-primary/30 bg-accent p-4 text-sm">
        VERIFIED means reviewed by this workspace owner. It is not independent
        certification or a guarantee of truth.
      </aside>
      {!archived && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form
            action={editClaimAction}
            className="rounded-xl border bg-card p-5"
          >
            <ClaimFields
              repositoryId={repository.id}
              claimId={claim.id}
              version={claim.version}
            />
            <label className="text-sm font-medium" htmlFor="claim-statement">
              Edit plain-text statement
            </label>
            <textarea
              id="claim-statement"
              name="statement"
              defaultValue={claim.statement}
              minLength={1}
              maxLength={500}
              required
              rows={4}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
            <button className="mt-3 rounded-md border px-3 py-2 text-sm">
              Save statement
            </button>
          </form>
          <form
            action={claimStatusAction}
            className="rounded-xl border bg-card p-5"
          >
            <ClaimFields
              repositoryId={repository.id}
              claimId={claim.id}
              version={claim.version}
            />
            <label className="text-sm font-medium" htmlFor="claim-operation">
              Review state
            </label>
            <select
              id="claim-operation"
              name="operation"
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="verify">Verify after review</option>
              <option value="draft">Return to draft</option>
              <option value="needs-evidence">Mark needs evidence</option>
            </select>
            <button className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              Apply review state
            </button>
          </form>
        </div>
      )}
      <div className="mt-8">
        <ClaimEvidenceGraph
          statement={claim.statement}
          evidence={claim.evidenceLinks.map((link) => link.repositoryEvidence)}
        />
      </div>
      <h2 className="mt-10 text-xl font-semibold">Linked evidence</h2>
      <ul className="mt-4 space-y-3">
        {claim.evidenceLinks.map((link) => {
          const evidence = link.repositoryEvidence;
          const url = safeGitHubSourceUrl(evidence.canonicalUrl);
          return (
            <li key={evidence.id} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold text-primary uppercase">
                {evidence.evidenceType} · Fact · {evidence.sourceAvailability}
              </p>
              <p className="mt-2 font-medium">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {evidence.title}
                  </a>
                ) : (
                  evidence.title
                )}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                First seen {evidence.firstSeenAt.toLocaleString()} · last seen{" "}
                {evidence.lastSeenAt.toLocaleString()} ·{" "}
                {evidence.observations.length} recent provenance observation
                {evidence.observations.length === 1 ? "" : "s"}
              </p>
              {!archived && (
                <form action={unlinkEvidenceAction} className="mt-3">
                  <ClaimFields
                    repositoryId={repository.id}
                    claimId={claim.id}
                    version={claim.version}
                  />
                  <input
                    type="hidden"
                    name="repositoryEvidenceId"
                    value={evidence.id}
                  />
                  <button className="rounded-md border px-3 py-2 text-xs">
                    Unlink evidence
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {!archived && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Evidence picker</h2>
          <ul className="mt-4 space-y-2">
            {availableEvidence.map((evidence) => (
              <li
                key={evidence.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
              >
                <span className="text-sm">
                  <strong>{evidence.evidenceType}</strong> · {evidence.title}
                </span>
                <form action={linkEvidenceAction}>
                  <ClaimFields
                    repositoryId={repository.id}
                    claimId={claim.id}
                    version={claim.version}
                  />
                  <input
                    type="hidden"
                    name="repositoryEvidenceId"
                    value={evidence.id}
                  />
                  <button className="rounded-md border px-3 py-2 text-xs">
                    Link evidence
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {!availableEvidence.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              No additional available evidence is in the bounded library.
            </p>
          )}
        </>
      )}
      <h2 className="mt-10 text-xl font-semibold">Revision history</h2>
      <ol className="mt-4 divide-y rounded-xl border bg-card">
        {claim.revisions.map((revision) => (
          <li key={revision.id} className="p-4 text-sm">
            <strong>
              v{revision.revisionNumber} · {revision.kind}
            </strong>
            <p className="mt-1">{revision.changeSummary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {revision.status} · {revision.actor.name} ·{" "}
              <time dateTime={revision.createdAt.toISOString()}>
                {revision.createdAt.toLocaleString()}
              </time>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ClaimFields({
  repositoryId,
  claimId,
  version,
}: {
  repositoryId: string;
  claimId: string;
  version: number;
}) {
  return (
    <>
      <input type="hidden" name="trackedRepositoryId" value={repositoryId} />
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="version" value={version} />
    </>
  );
}
