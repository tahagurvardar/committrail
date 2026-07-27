import Link from "next/link";
import { regenerateDraftAction } from "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/actions";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { getGroundedDraftProviderDescriptor } from "@/lib/drafting/provider-registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DraftsPage({
  params,
}: {
  params: Promise<{ trackedRepositoryId: string }>;
}) {
  const { trackedRepositoryId } = await params;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  const descriptor = getGroundedDraftProviderDescriptor();
  const requests = await getPrisma().draftGenerationRequest.findMany({
    where: {
      workspaceId: repository.workspaceId,
      trackedRepositoryId: repository.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        select: {
          reviewStatus: true,
          groundingStatus: true,
          acceptedClaimId: true,
        },
      },
      _count: { select: { evidenceSelections: true } },
    },
  });
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/repositories/${repository.id}`}
            className="text-sm text-primary underline"
          >
            Back to {repository.fullName}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">
            Private grounded drafts
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Suggestions use only evidence you select. Every retained sentence
            must cite selected evidence and still requires human review.
          </p>
        </div>
        <Link
          href={`/dashboard/repositories/${repository.id}/drafts/new`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Request a draft
        </Link>
      </div>
      {!descriptor.configured && (
        <aside className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <strong>Drafting provider not configured.</strong> Existing history
          remains available, but new generation is disabled.
        </aside>
      )}
      <ul className="mt-6 space-y-3">
        {requests.map((request) => (
          <li key={request.id} className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/dashboard/repositories/${repository.id}/drafts/${request.id}`}
                  className="font-medium underline"
                >
                  {request.draftingIntent}
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  {request.style.toLowerCase()} ·{" "}
                  {request.providerClassification.toLowerCase()} provider ·{" "}
                  {request._count.evidenceSelections} selected facts
                </p>
              </div>
              <span className="rounded-full border px-2 py-1 text-xs">
                {request.status}
                {request.candidate
                  ? ` · ${request.candidate.reviewStatus} · ${request.candidate.groundingStatus}`
                  : ""}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Queued {request.queuedAt.toLocaleString()}
              {request.startedAt
                ? ` · started ${request.startedAt.toLocaleString()}`
                : ""}
              {request.completedAt
                ? ` · completed ${request.completedAt.toLocaleString()}`
                : ""}
              {request.sanitizedErrorCode
                ? ` · ${request.sanitizedErrorCode}`
                : ""}
            </p>
            {request.status !== "QUEUED" &&
              request.status !== "RUNNING" &&
              request.candidate?.reviewStatus !== "ACCEPTED" && (
                <form action={regenerateDraftAction} className="mt-3">
                  <input
                    type="hidden"
                    name="trackedRepositoryId"
                    value={repository.id}
                  />
                  <input
                    type="hidden"
                    name="draftRequestId"
                    value={request.id}
                  />
                  <button className="rounded-md border px-3 py-2 text-xs">
                    Regenerate as a new request
                  </button>
                </form>
              )}
          </li>
        ))}
      </ul>
      {!requests.length && (
        <p className="mt-6 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          No private drafting requests exist for this repository.
        </p>
      )}
    </section>
  );
}
