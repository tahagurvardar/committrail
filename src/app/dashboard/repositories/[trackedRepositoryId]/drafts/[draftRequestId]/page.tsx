import Link from "next/link";
import {
  acceptDraftAsNewClaimAction,
  acceptDraftIntoClaimAction,
  regenerateDraftAction,
  rejectDraftCandidateAction,
} from "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/actions";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { refreshDraftGroundingStatus } from "@/lib/drafting/review-service";
import { safeGitHubSourceUrl } from "@/lib/evidence/safe-source-url";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{
    trackedRepositoryId: string;
    draftRequestId: string;
  }>;
}) {
  const { trackedRepositoryId, draftRequestId } = await params;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  await refreshDraftGroundingStatus({
    draftRequestId,
    trackedRepositoryId: repository.id,
  });
  const request = await getPrisma().draftGenerationRequest.findFirst({
    where: {
      id: draftRequestId,
      workspaceId: repository.workspaceId,
      trackedRepositoryId: repository.id,
    },
    include: {
      ingestionJob: {
        select: { attemptCount: true, maximumAttempts: true },
      },
      evidenceSelections: {
        orderBy: { position: "asc" },
        include: { repositoryEvidence: true },
      },
      candidate: {
        include: {
          sentences: {
            orderBy: { position: "asc" },
            include: {
              citations: {
                orderBy: { position: "asc" },
                include: {
                  selectedEvidence: {
                    include: { repositoryEvidence: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!request) notFound();
  const claims = await getPrisma().evidenceClaim.findMany({
    where: {
      workspaceId: repository.workspaceId,
      trackedRepositoryId: repository.id,
      status: { not: "ARCHIVED" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, statement: true, version: true, status: true },
  });
  const candidate = request.candidate;
  const reviewable =
    candidate?.reviewStatus === "READY" &&
    candidate.groundingStatus === "VALID";
  return (
    <section>
      <Link
        href={`/dashboard/repositories/${repository.id}/drafts`}
        className="text-sm text-primary underline"
      >
        Back to drafts
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-primary">Private AI-assisted suggestion</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {request.draftingIntent}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {request.status} · {request.style.toLowerCase()} ·{" "}
            {request.providerClassification.toLowerCase()} provider ·{" "}
            {request.modelLabel}
          </p>
        </div>
        {request.status !== "QUEUED" && request.status !== "RUNNING" && (
          <form action={regenerateDraftAction}>
            <RequestFields
              repositoryId={repository.id}
              requestId={request.id}
            />
            <button className="rounded-md border px-3 py-2 text-sm">
              Regenerate separately
            </button>
          </form>
        )}
      </div>
      <aside className="mt-6 rounded-xl border border-primary/30 bg-accent p-4 text-sm">
        This is an AI-assisted draft requiring human review. Structural
        grounding confirms citation mechanics only; it does not prove factual
        truth. No candidate can publish or verify a claim.
      </aside>
      <dl className="mt-6 grid gap-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Prompt template</dt>
          <dd>v{request.promptTemplateVersion}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Evidence bundle</dt>
          <dd>
            v{request.evidenceBundleVersion} ·{" "}
            <span className="font-mono">
              {request.evidenceBundleHash.slice(0, 12)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Input</dt>
          <dd>
            {request.inputEvidenceCount} facts ·{" "}
            {request.inputByteCount.toLocaleString()} bytes
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Timing</dt>
          <dd>
            {request.requestDurationMs !== null
              ? `${request.requestDurationMs} ms`
              : "Not completed"}
            {" · "}
            {request.ingestionJob
              ? `${request.ingestionJob.attemptCount}/${request.ingestionJob.maximumAttempts} attempts`
              : "no job"}
          </dd>
        </div>
      </dl>
      {request.sanitizedErrorCode && (
        <p className="border-destructive/40 mt-4 rounded-xl border p-4 text-sm">
          Generation failed safely: {request.sanitizedErrorCode}
        </p>
      )}
      {candidate ? (
        <>
          <div className="mt-8 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-primary uppercase">
                  Immutable candidate · {candidate.reviewStatus}
                </p>
                {candidate.title && (
                  <h2 className="mt-2 text-xl font-semibold">
                    {candidate.title}
                  </h2>
                )}
              </div>
              <span className="rounded-full border px-2 py-1 text-xs">
                Grounding {candidate.groundingStatus}
              </span>
            </div>
            <ol className="mt-5 space-y-4">
              {candidate.sentences.map((sentence, index) => (
                <li key={sentence.id} className="rounded-lg border p-4">
                  <p>
                    <span className="font-mono text-xs text-muted-foreground">
                      {index + 1}.
                    </span>{" "}
                    {sentence.text}
                  </p>
                  <ul
                    className="mt-3 flex flex-wrap gap-2"
                    aria-label={`Evidence citations for sentence ${index + 1}`}
                  >
                    {sentence.citations.map((citation) => {
                      const evidence =
                        citation.selectedEvidence.repositoryEvidence;
                      const url = safeGitHubSourceUrl(evidence.canonicalUrl);
                      return (
                        <li key={citation.repositoryEvidenceId}>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border px-2 py-1 text-xs underline"
                            >
                              {evidence.evidenceType}: {evidence.title}
                            </a>
                          ) : (
                            <span className="rounded-full border px-2 py-1 text-xs">
                              {evidence.evidenceType}: {evidence.title}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
            <h3 className="mt-6 font-semibold">Caveats</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {(candidate.caveats as string[]).map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
              {!(candidate.caveats as string[]).length && (
                <li>No provider caveats were returned.</li>
              )}
            </ul>
            <h3 className="mt-6 font-semibold">Mechanical coverage</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {candidate.citedSentenceCount}/{candidate.sentenceCount} cited
              sentences · {candidate.uniqueEvidenceCount} unique facts used ·{" "}
              {candidate.unusedSelectedEvidenceCount} selected facts unused ·
              types{" "}
              {(candidate.evidenceTypesUsed as string[]).join(", ") || "none"}
            </p>
            {(candidate.policyWarnings as string[]).length > 0 && (
              <p className="mt-3 text-sm">
                Review warnings:{" "}
                {(candidate.policyWarnings as string[]).join(", ")}
              </p>
            )}
          </div>
          {candidate.groundingStatus === "STALE" && (
            <aside className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              Selected evidence changed or became unavailable. This historical
              candidate is preserved, but acceptance is blocked.
            </aside>
          )}
          {reviewable && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <form
                action={acceptDraftAsNewClaimAction}
                className="rounded-xl border bg-card p-5"
              >
                <CandidateFields
                  repositoryId={repository.id}
                  requestId={request.id}
                  candidateId={candidate.id}
                />
                <h3 className="font-semibold">Accept as a new private claim</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  The claim starts DRAFT with AI-assisted provenance and cited
                  evidence. It is never verified automatically.
                </p>
                <button className="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  Accept as new claim
                </button>
              </form>
              <form
                action={rejectDraftCandidateAction}
                className="rounded-xl border bg-card p-5"
              >
                <CandidateFields
                  repositoryId={repository.id}
                  requestId={request.id}
                  candidateId={candidate.id}
                />
                <label htmlFor="rejection-reason" className="font-semibold">
                  Reject immutable candidate
                </label>
                <input
                  id="rejection-reason"
                  name="reason"
                  maxLength={240}
                  placeholder="Optional private reason"
                  className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <button className="mt-4 rounded-md border px-3 py-2 text-sm">
                  Reject candidate
                </button>
              </form>
            </div>
          )}
          {reviewable && claims.length > 0 && (
            <form
              action={acceptDraftIntoClaimAction}
              className="mt-4 rounded-xl border bg-card p-5"
            >
              <CandidateFields
                repositoryId={repository.id}
                requestId={request.id}
                candidateId={candidate.id}
              />
              <label htmlFor="claimTarget" className="font-semibold">
                Apply to an existing editable claim
              </label>
              <select
                id="claimTarget"
                name="claimTarget"
                className="mt-3 w-full rounded-md border bg-background px-3 py-2"
              >
                {claims.map((claim) => (
                  <option key={claim.id} value={`${claim.id}:${claim.version}`}>
                    {claim.status} · {claim.statement}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                The selected claim’s current optimistic version is checked
                server-side.
              </p>
              <button className="mt-4 rounded-md border px-3 py-2 text-sm">
                Replace selected claim draft
              </button>
            </form>
          )}
          {candidate.acceptedClaimId && (
            <p className="mt-5 text-sm">
              Accepted claim:{" "}
              <Link
                href={`/dashboard/repositories/${repository.id}/claims/${candidate.acceptedClaimId}`}
                className="text-primary underline"
              >
                open private claim
              </Link>
            </p>
          )}
          {candidate.rejectionReason && (
            <p className="mt-5 text-sm">
              Private rejection reason: {candidate.rejectionReason}
            </p>
          )}
        </>
      ) : (
        <p className="mt-8 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          {request.status === "QUEUED" || request.status === "RUNNING"
            ? "The durable worker has not persisted a validated candidate yet."
            : "No candidate was retained."}
        </p>
      )}
      <h2 className="mt-10 text-xl font-semibold">Selected source evidence</h2>
      <ul className="mt-4 space-y-3">
        {request.evidenceSelections.map((selection) => {
          const evidence = selection.repositoryEvidence;
          return (
            <li
              key={evidence.id}
              className="rounded-xl border bg-card p-4 text-sm"
            >
              <strong>{evidence.title}</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                {evidence.evidenceType} · {evidence.sourceAvailability} · hash{" "}
                <span className="font-mono">
                  {selection.evidenceContentHash.slice(0, 12)}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RequestFields({
  repositoryId,
  requestId,
}: {
  repositoryId: string;
  requestId: string;
}) {
  return (
    <>
      <input type="hidden" name="trackedRepositoryId" value={repositoryId} />
      <input type="hidden" name="draftRequestId" value={requestId} />
    </>
  );
}

function CandidateFields({
  repositoryId,
  requestId,
  candidateId,
}: {
  repositoryId: string;
  requestId: string;
  candidateId: string;
}) {
  return (
    <>
      <RequestFields repositoryId={repositoryId} requestId={requestId} />
      <input type="hidden" name="candidateId" value={candidateId} />
    </>
  );
}
