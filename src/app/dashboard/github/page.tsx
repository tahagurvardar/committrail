import { getGitHubAppConfig } from "@/lib/github-app/config";
import { requirePersonalWorkspace } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import {
  connectGitHubAction,
  disconnectGitHubAction,
} from "@/app/dashboard/actions";

export default async function GitHubPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { workspace } = await requirePersonalWorkspace();
  const installations = await getPrisma().gitHubInstallation.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { verifiedAt: "desc" },
  });
  const configured = getGitHubAppConfig() !== null;
  const status = (await searchParams).status;
  return (
    <section>
      <p className="text-sm font-medium text-primary">Verified connection</p>
      <h1 className="mt-2 text-3xl font-semibold">GitHub App</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        CommitTrail verifies both the installation through app authentication
        and the signed-in GitHub user’s access through state-bound OAuth with
        PKCE. Tokens are never persisted.
      </p>
      {status && (
        <p role="status" className="mt-5 rounded-md border bg-card p-4 text-sm">
          {status === "connected"
            ? "GitHub installation verified."
            : "The GitHub connection could not be verified. Start again."}
        </p>
      )}
      {!configured && (
        <div className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">GitHub App not configured</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Public exploration and your workspace remain available. A developer
            must configure the documented server-only GitHub App variables to
            connect.
          </p>
        </div>
      )}
      {configured && (
        <form action={connectGitHubAction} className="mt-6">
          <button className="rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground">
            Connect or reconnect GitHub
          </button>
        </form>
      )}
      <h2 className="mt-10 text-xl font-semibold">Verified installations</h2>
      {installations.length ? (
        <div className="mt-4 grid gap-4">
          {installations.map((installation) => (
            <article
              key={installation.id}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{installation.accountLogin}</h3>
                  <p className="text-sm text-muted-foreground">
                    {installation.accountType} ·{" "}
                    {installation.repositorySelection.toLowerCase()}{" "}
                    repositories
                  </p>
                </div>
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={installation.verifiedAt.toISOString()}
                >
                  Verified {installation.verifiedAt.toLocaleDateString()}
                </time>
              </div>
              <a
                className="mt-4 inline-block text-sm text-primary underline"
                href="https://github.com/settings/installations"
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage or uninstall on GitHub
              </a>
              <form
                action={disconnectGitHubAction}
                className="mt-5 flex flex-wrap gap-2"
              >
                <input
                  type="hidden"
                  name="installationId"
                  value={installation.id}
                />
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Type DISCONNECT to remove local installation-owned data
                  <input
                    name="confirmation"
                    required
                    pattern="DISCONNECT"
                    className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
                  />
                </label>
                <button className="self-end rounded-md border border-red-500/50 px-3 py-2 text-sm">
                  Disconnect locally
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No verified installation is connected.
        </p>
      )}
    </section>
  );
}
