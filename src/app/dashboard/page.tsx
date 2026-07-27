import Link from "next/link";
import { requirePersonalWorkspace } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { getWebhookConfiguration } from "@/lib/webhooks/config";

export default async function DashboardPage() {
  const { workspace } = await requirePersonalWorkspace();
  const [
    installations,
    repositories,
    recentRuns,
    deliveryGroups,
    duplicateDeliveries,
    jobGroups,
    failures,
  ] = await Promise.all([
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
    getPrisma().webhookDelivery.groupBy({
      by: ["status"],
      where: { workspaceId: workspace.id },
      _count: true,
    }),
    getPrisma().webhookDelivery.aggregate({
      where: { workspaceId: workspace.id },
      _sum: { duplicateCount: true },
    }),
    getPrisma().ingestionJob.groupBy({
      by: ["status"],
      where: { workspaceId: workspace.id },
      _count: true,
    }),
    getPrisma().ingestionJob.findMany({
      where: {
        workspaceId: workspace.id,
        sanitizedLastErrorCode: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        kind: true,
        status: true,
        sanitizedLastErrorCode: true,
        trackedRepository: { select: { id: true, fullName: true } },
      },
    }),
  ]);
  const webhook = getWebhookConfiguration();
  const deliveryCount = Object.fromEntries(
    deliveryGroups.map((group) => [group.status, group._count]),
  );
  const jobCount = Object.fromEntries(
    jobGroups.map((group) => [group.status, group._count]),
  );
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
      <h2 className="mt-10 text-xl font-semibold">
        Webhook and worker overview
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Webhook configuration</p>
          <p className="mt-2 font-medium">
            {webhook.configured ? "Configured" : "Not configured"}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Processed / ignored / duplicates
          </p>
          <p className="mt-2 font-medium">
            {deliveryCount.PROCESSED ?? 0} / {deliveryCount.IGNORED ?? 0} /{" "}
            {duplicateDeliveries._sum.duplicateCount ?? 0}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Pending / running jobs
          </p>
          <p className="mt-2 font-medium">
            {jobCount.PENDING ?? 0} / {jobCount.RUNNING ?? 0}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Dead jobs</p>
          <p className="mt-2 font-medium">{jobCount.DEAD ?? 0}</p>
        </article>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Configure the GitHub App endpoint at <code>/api/github/webhooks</code>{" "}
        and run <code>npm run worker:ingestion</code>. Event subscription steps
        are documented in the repository.
      </p>
      {failures.length > 0 && (
        <>
          <h3 className="mt-6 font-semibold">Latest sanitized failures</h3>
          <ul className="mt-3 divide-y rounded-xl border bg-card">
            {failures.map((failure) => (
              <li key={failure.id} className="p-3 text-sm">
                {failure.trackedRepository ? (
                  <Link
                    href={`/dashboard/repositories/${failure.trackedRepository.id}`}
                    className="underline"
                  >
                    {failure.trackedRepository.fullName}
                  </Link>
                ) : (
                  "Installation"
                )}{" "}
                · {failure.kind} · {failure.status} ·{" "}
                {failure.sanitizedLastErrorCode}
              </li>
            ))}
          </ul>
        </>
      )}
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
