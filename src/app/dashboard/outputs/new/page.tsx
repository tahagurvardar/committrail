import Link from "next/link";
import { createPortfolioOutputAction } from "../actions";
import { OutputEditor } from "../output-editor";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewOutputPage() {
  const { workspace } = await requireWorkspaceOwner();
  const repositories = await outputRepositories(workspace.id);
  return (
    <section>
      <Link
        href="/dashboard/outputs"
        className="text-sm text-primary underline"
      >
        Back to outputs
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">
        New deterministic portfolio output
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Fill only the fields for your selected template. Saved revisions are
        append-only and private.
      </p>
      <form action={createPortfolioOutputAction} className="mt-8">
        <OutputEditor repositories={repositories} />
        <button className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Build and save revision
        </button>
      </form>
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
