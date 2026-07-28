import Link from "next/link";
import { createPublicationAction } from "../actions";
import { PublicationEditor } from "../publication-editor";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPublicationPage() {
  const { workspace } = await requireWorkspaceOwner();
  const [profile, repositories] = await Promise.all([
    getPrisma().publicProfile.findUnique({
      where: { workspaceId: workspace.id },
    }),
    publicationEditorRepositories(workspace.id),
  ]);
  if (!profile)
    return (
      <section>
        <h1 className="text-3xl font-semibold">Public profile required</h1>
        <p className="mt-4 text-sm">
          <Link href="/dashboard/profile" className="text-primary underline">
            Create your minimal public profile
          </Link>{" "}
          before drafting a project publication.
        </p>
      </section>
    );
  return (
    <section>
      <Link
        href="/dashboard/publications"
        className="text-sm text-primary underline"
      >
        Back to publications
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">
        New private publication draft
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        This form cannot publish. It saves a private, no-store configuration for
        exact preview and later explicit confirmation.
      </p>
      <form action={createPublicationAction} className="mt-8">
        <PublicationEditor repositories={repositories} />
        <button className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Save private draft
        </button>
      </form>
    </section>
  );
}

async function publicationEditorRepositories(workspaceId: string) {
  const repositories = await getPrisma().trackedRepository.findMany({
    where: { workspaceId, trackingStatus: "ACTIVE" },
    orderBy: { fullName: "asc" },
    include: {
      evidenceClaims: {
        where: { status: "VERIFIED", verifiedAt: { not: null } },
        orderBy: { updatedAt: "desc" },
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
