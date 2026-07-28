import Link from "next/link";
import {
  retryDeadIngestionJobAction,
  syncRepositoryAction,
} from "@/app/dashboard/actions";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { getWebhookConfiguration } from "@/lib/webhooks/config";

export default async function TrackedRepositoryPage({
  params,
}: {
  params: Promise<{ trackedRepositoryId: string }>;
}) {
  const { trackedRepositoryId } = await params;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  const [claimCount, draftCount, observationCount, deliveries, jobs] =
    await Promise.all([
      getPrisma().evidenceClaim.count({
        where: { trackedRepositoryId: repository.id },
      }),
      getPrisma().draftGenerationRequest.count({
        where: { trackedRepositoryId: repository.id },
      }),
      getPrisma().evidenceObservation.count({
        where: { repositoryEvidence: { trackedRepositoryId: repository.id } },
      }),
      getPrisma().webhookDelivery.findMany({
        where: { trackedRepositoryId: repository.id },
        orderBy: { receivedAt: "desc" },
        take: 10,
      }),
      getPrisma().ingestionJob.findMany({
        where: { trackedRepositoryId: repository.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
  const webhook = getWebhookConfiguration();
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
            {repository.installation?.suspendedAt
              ? " · installation suspended"
              : ""}
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
      <nav
        aria-label="Repository evidence, drafts, and claims"
        className="mt-6 flex flex-wrap gap-3"
      >
        <Link
          href={`/dashboard/repositories/${repository.id}/evidence`}
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Evidence library · {repository.evidence.length} shown
        </Link>
        <Link
          href={`/dashboard/repositories/${repository.id}/drafts`}
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Private drafts · {draftCount}
        </Link>
        <Link
          href={`/dashboard/repositories/${repository.id}/claims`}
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Claims · {claimCount}
        </Link>
      </nav>
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
      <h2 className="mt-10 text-xl font-semibold">
        Webhook and ingestion health
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Webhook secret</p>
          <p className="mt-2 font-medium">
            {webhook.configured ? "Configured" : "Not configured"}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Recent deliveries</p>
          <p className="mt-2 font-medium">{deliveries.length}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Evidence observations</p>
          <p className="mt-2 font-medium">{observationCount}</p>
        </article>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Manual <strong>Sync now</strong> remains the recovery path for missed or
        failed webhook deliveries.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-160 text-left text-sm">
          <caption className="sr-only">
            Latest verified GitHub webhook deliveries
          </caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Event</th>
              <th className="p-3">Action</th>
              <th className="p-3">State</th>
              <th className="p-3">Duplicates</th>
              <th className="p-3">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td className="p-3">{delivery.eventName}</td>
                <td className="p-3">{delivery.action ?? "—"}</td>
                <td className="p-3">
                  {delivery.status}
                  {delivery.ignoredReason ? ` · ${delivery.ignoredReason}` : ""}
                </td>
                <td className="p-3">{delivery.duplicateCount}</td>
                <td className="p-3">
                  <time dateTime={delivery.receivedAt.toISOString()}>
                    {delivery.receivedAt.toLocaleString()}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!deliveries.length && (
        <p className="mt-3 text-sm text-muted-foreground">
          No verified deliveries for this repository yet.
        </p>
      )}
      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-160 text-left text-sm">
          <caption className="sr-only">Recent webhook ingestion jobs</caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Kind</th>
              <th className="p-3">State</th>
              <th className="p-3">Attempts</th>
              <th className="p-3">Last error</th>
              <th className="p-3">Recovery</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="p-3">{job.kind}</td>
                <td className="p-3">{job.status}</td>
                <td className="p-3">
                  {job.attemptCount}/{job.maximumAttempts}
                </td>
                <td className="p-3">{job.sanitizedLastErrorCode ?? "None"}</td>
                <td className="p-3">
                  {job.status === "DEAD" ? (
                    <form action={retryDeadIngestionJobAction}>
                      <input
                        type="hidden"
                        name="trackedRepositoryId"
                        value={repository.id}
                      />
                      <input type="hidden" name="jobId" value={job.id} />
                      <button className="rounded-md border px-3 py-1.5 text-xs">
                        Create safe retry
                      </button>
                    </form>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!jobs.length && (
        <p className="mt-3 text-sm text-muted-foreground">
          No webhook ingestion jobs yet.
        </p>
      )}
    </section>
  );
}
