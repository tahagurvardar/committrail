import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { safeGitHubSourceUrl } from "@/lib/evidence/safe-source-url";

const TYPES = [
  "commit",
  "pull-request",
  "issue",
  "release",
  "workflow-run",
] as const;
const AVAILABILITY = ["AVAILABLE", "UNAVAILABLE", "DELETED"] as const;

export default async function EvidenceLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ trackedRepositoryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { trackedRepositoryId } = await params;
  const query = await searchParams;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  const type = typeof query.type === "string" ? query.type : "";
  const availability =
    typeof query.availability === "string" ? query.availability : "";
  const search =
    typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const from = validDate(typeof query.from === "string" ? query.from : "");
  const to = validDate(typeof query.to === "string" ? query.to : "", true);
  const where: Prisma.RepositoryEvidenceWhereInput = {
    trackedRepositoryId: repository.id,
    ...(TYPES.includes(type as (typeof TYPES)[number])
      ? { evidenceType: type }
      : {}),
    ...(AVAILABILITY.includes(availability as (typeof AVAILABILITY)[number])
      ? { sourceAvailability: availability as (typeof AVAILABILITY)[number] }
      : {}),
    ...(search
      ? { title: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };
  const evidence = await getPrisma().repositoryEvidence.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: 100,
    include: {
      _count: { select: { claimLinks: true, observations: true } },
      observations: { orderBy: { observedAt: "desc" }, take: 1 },
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
      <h1 className="mt-3 text-3xl font-semibold">Evidence library</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Persisted, normalized facts from bounded GitHub samples. Older evidence
        outside the current sample is preserved.
      </p>
      <form className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          Search titles
          <input
            name="q"
            defaultValue={search}
            maxLength={100}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Evidence type
          <select
            name="type"
            defaultValue={type}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          >
            <option value="">All types</option>
            {TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Availability
          <select
            name="availability"
            defaultValue={availability}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          >
            <option value="">Any state</option>
            {AVAILABILITY.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          From
          <input
            type="date"
            name="from"
            defaultValue={typeof query.from === "string" ? query.from : ""}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Through
          <input
            type="date"
            name="to"
            defaultValue={typeof query.to === "string" ? query.to : ""}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2 lg:col-span-5">
          Apply filters
        </button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
        Showing {evidence.length} of at most 100 matching facts.
      </p>
      <ul className="mt-4 space-y-3">
        {evidence.map((item) => {
          const sourceUrl = safeGitHubSourceUrl(item.canonicalUrl);
          return (
            <li key={item.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary uppercase">
                  {item.evidenceType} · Fact
                </span>
                <span className="text-xs">{item.sourceAvailability}</span>
              </div>
              <p className="mt-2 font-medium">
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </p>
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>
                  <dt>First seen</dt>
                  <dd>{item.firstSeenAt.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Last seen</dt>
                  <dd>{item.lastSeenAt.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Observations</dt>
                  <dd>
                    {item._count.observations}
                    {item.observations[0]
                      ? ` · latest ${item.observations[0].sourceKind.toLowerCase()}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Linked claims</dt>
                  <dd>{item._count.claimLinks}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      {!evidence.length && (
        <p className="mt-6 text-sm text-muted-foreground">
          No stored evidence matches these filters.
        </p>
      )}
    </section>
  );
}

function validDate(value: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const result = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`,
  );
  return Number.isNaN(result.getTime()) ? null : result;
}
