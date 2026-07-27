import Link from "next/link";
import { requirePersonalWorkspace } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { discoverInstallationRepositories } from "@/lib/github-app/client";
import { trackRepositoryAction } from "@/app/dashboard/actions";

export default async function RepositoriesPage() {
  const { workspace } = await requirePersonalWorkspace();
  const [tracked, installations] = await Promise.all([
    getPrisma().trackedRepository.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    }),
    getPrisma().gitHubInstallation.findMany({
      where: { workspaceId: workspace.id, suspendedAt: null },
    }),
  ]);
  const available = [];
  for (const installation of installations) {
    try {
      const discovery = await discoverInstallationRepositories(
        installation.installationId,
      );
      await getPrisma().gitHubInstallation.update({
        where: { id: installation.id },
        data: { lastRepositoryDiscoveryAt: new Date() },
      });
      available.push({ installation, ...discovery });
    } catch {
      available.push({
        installation,
        repositories: [],
        discardedRecordCount: 0,
        hasMore: false,
        unavailable: true,
      });
    }
  }
  const trackedIds = new Set(
    tracked.map((repository) => repository.githubRepositoryId.toString()),
  );
  return (
    <section>
      <p className="text-sm font-medium text-primary">Installation-scoped</p>
      <h1 className="mt-2 text-3xl font-semibold">Repositories</h1>
      <h2 className="mt-8 text-xl font-semibold">Tracked</h2>
      {tracked.length ? (
        <ul className="mt-4 grid gap-3">
          {tracked.map((repository) => (
            <li key={repository.id} className="rounded-xl border bg-card p-4">
              <Link
                href={`/dashboard/repositories/${repository.id}`}
                className="font-medium text-primary underline"
              >
                {repository.fullName}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {repository.visibility} · last status{" "}
                {repository.latestSyncStatus?.toLowerCase() ??
                  "not synchronized"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No repositories are tracked yet.
        </p>
      )}
      <h2 className="mt-10 text-xl font-semibold">
        Available through verified installations
      </h2>
      {available.map((group) => (
        <article
          key={group.installation.id}
          className="mt-4 rounded-xl border bg-card p-5"
        >
          <h3 className="font-semibold">{group.installation.accountLogin}</h3>
          {"unavailable" in group && group.unavailable ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Repository discovery is temporarily unavailable.
            </p>
          ) : (
            <>
              <ul className="mt-4 divide-y">
                {group.repositories.map((repository) => (
                  <li
                    key={repository.id.toString()}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{repository.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {repository.visibility}
                        {repository.archived ? " · archived" : ""}
                        {repository.fork ? " · fork" : ""}
                      </p>
                    </div>
                    {trackedIds.has(repository.id.toString()) ? (
                      <span className="text-sm text-muted-foreground">
                        Tracked
                      </span>
                    ) : (
                      <form action={trackRepositoryAction}>
                        <input
                          type="hidden"
                          name="installationId"
                          value={group.installation.id}
                        />
                        <input
                          type="hidden"
                          name="repositoryId"
                          value={repository.id.toString()}
                        />
                        <button className="rounded-md border px-3 py-2 text-sm">
                          Track and initial sync
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Showing up to 100 validated repositories from this page.
                {group.hasMore ? " More may exist on GitHub." : ""}
                {group.discardedRecordCount
                  ? ` ${group.discardedRecordCount} malformed records omitted.`
                  : ""}
              </p>
            </>
          )}
        </article>
      ))}
      {!installations.length && (
        <p className="mt-3 text-sm text-muted-foreground">
          Connect a verified GitHub App installation first.
        </p>
      )}
    </section>
  );
}
