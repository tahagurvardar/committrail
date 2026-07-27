import Link from "next/link";
import { requirePersonalWorkspace } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";

export default async function DashboardPage() {
  const { workspace } = await requirePersonalWorkspace();
  const [installations, repositories, recentRuns] = await Promise.all([
    getPrisma().gitHubInstallation.count({
      where: { workspaceId: workspace.id },
    }),
    getPrisma().trackedRepository.count({
      where: { workspaceId: workspace.id, trackingStatus: "ACTIVE" },
    }),
    getPrisma().repositorySyncRun.findMany({
      where: { trackedRepository: { workspaceId: workspace.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { trackedRepository: { select: { fullName: true } } },
    }),
  ]);
  return (
    <section>
      <p className="text-sm font-medium text-primary">Personal workspace</p>
      <h1 className="mt-2 text-3xl font-semibold">{workspace.name}</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Verified installations
          </p>
          <p className="mt-2 text-3xl font-semibold">{installations}</p>
          <Link
            className="mt-4 inline-block text-sm text-primary underline"
            href="/dashboard/github"
          >
            Manage GitHub
          </Link>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Tracked repositories</p>
          <p className="mt-2 text-3xl font-semibold">{repositories}</p>
          <Link
            className="mt-4 inline-block text-sm text-primary underline"
            href="/dashboard/repositories"
          >
            Manage repositories
          </Link>
        </article>
      </div>
      <h2 className="mt-10 text-xl font-semibold">Recent synchronization</h2>
      {recentRuns.length ? (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {recentRuns.map((run) => (
            <li key={run.id} className="flex justify-between gap-4 p-4 text-sm">
              <span>{run.trackedRepository.fullName}</span>
              <span>
                {run.status} ·{" "}
                <time dateTime={run.createdAt.toISOString()}>
                  {run.createdAt.toLocaleString()}
                </time>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No synchronization runs yet.
        </p>
      )}
    </section>
  );
}
