import Link from "next/link";
import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OutputsPage() {
  const { workspace } = await requireWorkspaceOwner();
  const outputs = await getPrisma().portfolioOutput.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: { trackedRepository: { select: { fullName: true } } },
  });
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Portfolio outputs</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Deterministic private case studies, CV bullets, and interview
            stories built only from verified claims and your own text. No model
            provider is called.
          </p>
        </div>
        <Link
          href="/dashboard/outputs/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New output
        </Link>
      </div>
      <ul className="mt-8 space-y-4">
        {outputs.map((output) => (
          <li key={output.id} className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">{output.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {output.type} · {output.status} ·{" "}
              {output.trackedRepository.fullName}
            </p>
            <Link
              href={`/dashboard/outputs/${output.id}`}
              className="mt-3 inline-block text-sm text-primary underline"
            >
              Review output and downloads
            </Link>
          </li>
        ))}
      </ul>
      {!outputs.length ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No saved outputs yet. Outputs never publish automatically.
        </p>
      ) : null}
    </section>
  );
}
