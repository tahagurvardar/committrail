import Link from "next/link";
import { createClaimAction } from "@/app/dashboard/repositories/[trackedRepositoryId]/claims/actions";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ trackedRepositoryId: string }>;
}) {
  const { trackedRepositoryId } = await params;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  const claims = await getPrisma().evidenceClaim.findMany({
    where: {
      trackedRepositoryId: repository.id,
      workspaceId: repository.workspaceId,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { name: true } },
      evidenceLinks: {
        include: {
          repositoryEvidence: { select: { evidenceType: true } },
        },
      },
    },
  });
  return (
    <section>
      <Link
        href={`/dashboard/repositories/${repository.id}`}
        className="text-sm text-primary underline"
      >
        Back to {repository.fullName}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">Human-authored claims</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Private statements reviewed by the workspace owner. CommitTrail does not
        generate claim text.
      </p>
      <form
        action={createClaimAction}
        className="mt-6 rounded-xl border bg-card p-5"
      >
        <input type="hidden" name="trackedRepositoryId" value={repository.id} />
        <label className="block text-sm font-medium" htmlFor="new-statement">
          New claim statement
        </label>
        <textarea
          id="new-statement"
          name="statement"
          required
          minLength={1}
          maxLength={500}
          rows={3}
          aria-describedby="statement-help"
          className="mt-2 w-full rounded-md border bg-background px-3 py-2"
        />
        <p id="statement-help" className="mt-2 text-xs text-muted-foreground">
          Plain text, 1–500 characters. A new claim needs linked evidence.
        </p>
        <button className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Create claim
        </button>
      </form>
      <ul className="mt-6 space-y-3">
        {claims.map((claim) => {
          const types = [
            ...new Set(
              claim.evidenceLinks.map(
                (link) => link.repositoryEvidence.evidenceType,
              ),
            ),
          ];
          return (
            <li key={claim.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={`/dashboard/repositories/${repository.id}/claims/${claim.id}`}
                  className="font-medium underline"
                >
                  {claim.statement}
                </Link>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {claim.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {claim.evidenceLinks.length} linked fact
                {claim.evidenceLinks.length === 1 ? "" : "s"}
                {types.length ? ` · ${types.join(", ")}` : ""} · author{" "}
                {claim.author.name} · updated {claim.updatedAt.toLocaleString()}
              </p>
            </li>
          );
        })}
      </ul>
      {!claims.length && (
        <p className="mt-6 text-sm text-muted-foreground">
          No claims have been created for this repository.
        </p>
      )}
    </section>
  );
}
