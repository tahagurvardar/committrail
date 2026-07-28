import Link from "next/link";
import {
  archivePortfolioOutputAction,
  updatePortfolioOutputAction,
} from "../actions";
import { OutputEditor } from "../output-editor";
import { getAuthorizedPortfolioOutput } from "@/lib/portfolio/output-service";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OutputDetailPage({
  params,
}: {
  params: Promise<{ outputId: string }>;
}) {
  const { outputId } = await params;
  const { output, workspace } = await getAuthorizedPortfolioOutput(outputId);
  const repositories = await outputRepositories(workspace.id);
  const fields =
    output.draftFields &&
    typeof output.draftFields === "object" &&
    !Array.isArray(output.draftFields)
      ? (output.draftFields as Record<string, unknown>)
      : {};
  const claims = new Map(
    output.claimSelections.map((selection) => [
      selection.claimId,
      {
        position: selection.position,
        statementOverride: selection.statementOverride,
      },
    ]),
  );
  return (
    <section>
      <Link
        href="/dashboard/outputs"
        className="text-sm text-primary underline"
      >
        Back to outputs
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">{output.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {output.type} · {output.status} · version {output.version}
      </p>
      {output.currentRevision ? (
        <section className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">
            Saved revision {output.currentRevision.revisionNumber}
          </h2>
          <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
            {output.currentRevision.renderedText}
          </pre>
          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Download formats"
          >
            {[
              ["txt", "Plain text"],
              ["md", "Markdown"],
              ["json", "Versioned JSON"],
            ].map(([format, label]) => (
              <a
                key={format}
                href={`/api/outputs/${output.id}/download?format=${format}`}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Download {label}
              </a>
            ))}
          </div>
        </section>
      ) : null}
      {output.status !== "ARCHIVED" ? (
        <form action={updatePortfolioOutputAction} className="mt-8">
          <input type="hidden" name="outputId" value={output.id} />
          <input type="hidden" name="expectedVersion" value={output.version} />
          <OutputEditor
            repositories={repositories}
            defaults={{
              trackedRepositoryId: output.trackedRepositoryId,
              type: output.type,
              title: output.title,
              fields,
              claims,
            }}
          />
          <button className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Save new immutable revision
          </button>
        </form>
      ) : null}
      {output.status !== "ARCHIVED" ? (
        <form
          action={archivePortfolioOutputAction}
          className="mt-8 max-w-sm rounded-xl border p-4"
        >
          <input type="hidden" name="outputId" value={output.id} />
          <input type="hidden" name="expectedVersion" value={output.version} />
          <label
            className="block text-sm"
            htmlFor="output-archive-confirmation"
          >
            Type ARCHIVE
            <input
              id="output-archive-confirmation"
              name="confirmation"
              required
              pattern="ARCHIVE"
              className="mt-2 w-full rounded border bg-background px-2 py-2"
            />
          </label>
          <button className="mt-3 rounded border px-3 py-2 text-sm">
            Archive output
          </button>
        </form>
      ) : null}
    </section>
  );
}

async function outputRepositories(workspaceId: string) {
  const repositories = await getPrisma().trackedRepository.findMany({
    where: { workspaceId, trackingStatus: "ACTIVE" },
    orderBy: { fullName: "asc" },
    include: {
      evidenceClaims: {
        where: { status: "VERIFIED", verifiedAt: { not: null } },
        include: {
          evidenceLinks: {
            where: { repositoryEvidence: { sourceAvailability: "AVAILABLE" } },
          },
        },
      },
    },
  });
  return repositories.map((repository) => ({
    id: repository.id,
    fullName: repository.fullName,
    claims: repository.evidenceClaims
      .filter((claim) => claim.evidenceLinks.length)
      .map((claim) => ({
        id: claim.id,
        statement: claim.statement,
        origin: claim.origin,
      })),
  }));
}
