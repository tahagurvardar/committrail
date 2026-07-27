import { syncRepositoryAction } from "@/app/dashboard/actions";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";

export default async function TrackedRepositoryPage({
  params,
}: {
  params: Promise<{ trackedRepositoryId: string }>;
}) {
  const { trackedRepositoryId } = await params;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  const snapshot = repository.snapshot?.normalizedData as
    Record<string, unknown> | undefined;
  const identity = snapshot?.identity as Record<string, unknown> | undefined;
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            Persisted repository
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{repository.fullName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {repository.visibility} · {repository.trackingStatus.toLowerCase()}{" "}
            · bounded recent samples
          </p>
        </div>
        <form action={syncRepositoryAction}>
          <input
            type="hidden"
            name="trackedRepositoryId"
            value={repository.id}
          />
          <button className="rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground">
            Sync now
          </button>
        </form>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Last successful sync</p>
          <p className="mt-2 font-medium">
            {repository.lastSuccessfulSyncAt?.toLocaleString() ?? "Not yet"}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Latest sync status</p>
          <p className="mt-2 font-medium">
            {repository.latestSyncStatus ?? "None"}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Persisted evidence</p>
          <p className="mt-2 font-medium">{repository.evidence.length} shown</p>
        </article>
      </div>
      {snapshot && (
        <article className="mt-8 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Snapshot facts</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">
                Canonical identity
              </dt>
              <dd>{String(identity?.fullName ?? repository.fullName)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Default branch</dt>
              <dd>
                {String(snapshot.defaultBranch ?? repository.defaultBranch)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Visibility</dt>
              <dd>{snapshot.isPrivate ? "Private" : "Public"}</dd>
            </div>
          </dl>
        </article>
      )}
      <h2 className="mt-10 text-xl font-semibold">
        Persisted bounded evidence timeline
      </h2>
      {repository.evidence.length ? (
        <ol className="mt-4 divide-y rounded-xl border bg-card">
          {repository.evidence.map((evidence) => (
            <li key={evidence.evidenceId} className="p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-xs font-medium text-primary uppercase">
                  {evidence.evidenceType} · Fact
                </span>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={evidence.occurredAt.toISOString()}
                >
                  {evidence.occurredAt.toLocaleString()}
                </time>
              </div>
              <a
                href={evidence.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block font-medium underline"
              >
                {evidence.title}
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No evidence has been persisted yet.
        </p>
      )}
      <h2 className="mt-10 text-xl font-semibold">Sync history</h2>
      <ul className="mt-4 divide-y rounded-xl border bg-card">
        {repository.syncRuns.map((run) => (
          <li key={run.id} className="p-4 text-sm">
            <strong>{run.status}</strong> · {run.mode.toLowerCase()} · seen{" "}
            {run.seenCount}
            <span className="text-muted-foreground">
              {" "}
              ·{" "}
              <time dateTime={run.startedAt.toISOString()}>
                {run.startedAt.toLocaleString()}
              </time>
            </span>
            {run.sanitizedErrorCode && <span> · {run.sanitizedErrorCode}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
