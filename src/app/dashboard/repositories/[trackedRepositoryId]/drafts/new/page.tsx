import Link from "next/link";
import {
  grantDraftingConsentAction,
  queueDraftGenerationAction,
  revokeDraftingConsentAction,
} from "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/actions";
import { getAuthorizedTrackedRepository } from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { hasCurrentExternalConsent } from "@/lib/drafting/consent-service";
import { getGroundedDraftProviderDescriptor } from "@/lib/drafting/provider-registry";
import {
  DRAFT_USER_TEN_MINUTE_LIMIT,
  DRAFT_WORKSPACE_DAILY_LIMIT,
} from "@/lib/drafting/service";
import { DraftEvidencePicker } from "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/new/evidence-picker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ trackedRepositoryId: string }>;
  searchParams: Promise<{ type?: string; from?: string }>;
}) {
  const { trackedRepositoryId } = await params;
  const filters = await searchParams;
  const { repository } =
    await getAuthorizedTrackedRepository(trackedRepositoryId);
  const descriptor = getGroundedDraftProviderDescriptor();
  const consent = await hasCurrentExternalConsent(
    repository.workspaceId,
    descriptor,
  );
  const from = filters.from ? new Date(filters.from) : null;
  const evidence = await getPrisma().repositoryEvidence.findMany({
    where: {
      trackedRepositoryId: repository.id,
      sourceAvailability: "AVAILABLE",
      ...(filters.type ? { evidenceType: filters.type } : {}),
      ...(from && !Number.isNaN(from.getTime())
        ? { occurredAt: { gte: from } }
        : {}),
    },
    orderBy: [{ occurredAt: "desc" }, { evidenceId: "asc" }],
    take: 100,
  });
  const canQueue =
    descriptor.configured && (descriptor.classification === "LOCAL" || consent);
  return (
    <section>
      <Link
        href={`/dashboard/repositories/${repository.id}/drafts`}
        className="text-sm text-primary underline"
      >
        Back to drafts
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">Request a grounded draft</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Select 1–12 accessible facts from this repository. Canonical evidence is
        reloaded server-side; text submitted through hidden fields is never
        trusted.
      </p>
      <aside className="mt-6 rounded-xl border bg-card p-5 text-sm">
        <p className="font-medium">
          {descriptor.configured
            ? `${descriptor.classification.toLowerCase()} provider · ${descriptor.modelLabel}`
            : "Drafting provider not configured"}
        </p>
        <p className="mt-2 text-muted-foreground">
          {descriptor.classification === "EXTERNAL"
            ? "Selected normalized evidence leaves the CommitTrail process. Provider retention is governed by that provider; CommitTrail makes no retention promise on its behalf."
            : descriptor.configured
              ? "Selected evidence is sent from CommitTrail to the configured loopback provider on this machine. External-transfer consent is not required, but the local service controls its own retention."
              : "No selected evidence is sent while drafting is disabled."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Maximum {descriptor.maximumEvidenceCount} facts ·{" "}
          {descriptor.maximumRequestBytes.toLocaleString()} input bytes ·{" "}
          {descriptor.maximumOutputBytes.toLocaleString()} output bytes.
        </p>
        {descriptor.classification === "EXTERNAL" &&
          descriptor.configured &&
          (consent ? (
            <form action={revokeDraftingConsentAction} className="mt-4">
              <input
                type="hidden"
                name="trackedRepositoryId"
                value={repository.id}
              />
              <button className="rounded-md border px-3 py-2 text-sm">
                Revoke external-transfer consent
              </button>
            </form>
          ) : (
            <form action={grantDraftingConsentAction} className="mt-4">
              <input
                type="hidden"
                name="trackedRepositoryId"
                value={repository.id}
              />
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="acknowledgement"
                  value="accepted"
                  required
                  className="mt-1"
                />
                <span>
                  I explicitly consent to sending only my selected normalized
                  evidence and drafting intent to this currently configured
                  external provider.
                </span>
              </label>
              <button className="mt-3 rounded-md border px-3 py-2 text-sm">
                Grant consent for this provider
              </button>
            </form>
          ))}
      </aside>
      <form
        method="get"
        className="mt-6 flex flex-wrap gap-3 rounded-xl border p-4"
      >
        <label className="text-sm">
          Evidence type
          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="ml-2 rounded-md border bg-background px-2 py-1"
          >
            <option value="">All</option>
            {["commit", "pull-request", "issue", "release", "workflow-run"].map(
              (type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="text-sm">
          Occurred since
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className="ml-2 rounded-md border bg-background px-2 py-1"
          />
        </label>
        <button className="rounded-md border px-3 py-1 text-sm">
          Apply filters
        </button>
      </form>
      <form action={queueDraftGenerationAction} className="mt-6">
        <input type="hidden" name="trackedRepositoryId" value={repository.id} />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 text-sm">
            <label className="font-medium" htmlFor="draft-intent">
              Private drafting intent
            </label>
            <textarea
              aria-describedby="draft-intent-help"
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
              id="draft-intent"
              maxLength={500}
              minLength={1}
              name="intent"
              placeholder="Describe the technical point you want to communicate."
              required
              rows={5}
            />
            <span
              id="draft-intent-help"
              className="mt-2 block text-xs text-muted-foreground"
            >
              Plain text, 1–500 characters. It is isolated as untrusted data,
              not provider instructions.
            </span>
          </div>
          <div className="rounded-xl border bg-card p-5 text-sm">
            <label className="font-medium" htmlFor="draft-style">
              Constrained style
            </label>
            <select
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
              id="draft-style"
              name="style"
            >
              <option value="CONCISE">Concise</option>
              <option value="TECHNICAL">Technical</option>
              <option value="INTERVIEW">Interview</option>
            </select>
            <span className="mt-3 block text-xs text-muted-foreground">
              Limits: {DRAFT_USER_TEN_MINUTE_LIMIT} submissions per user per ten
              minutes and {DRAFT_WORKSPACE_DAILY_LIMIT} per workspace per
              rolling day. No cost estimate is inferred.
            </span>
          </div>
        </div>
        <fieldset className="mt-6">
          <legend className="text-lg font-semibold">
            Explicit evidence selection
          </legend>
          <p className="mt-1 text-sm text-muted-foreground">
            Every generated sentence must cite at least one selected item.
          </p>
          <DraftEvidencePicker
            canQueue={canQueue}
            evidence={evidence.map((item) => ({
              id: item.id,
              title: item.title,
              evidenceType: item.evidenceType,
              occurredAtLabel: item.occurredAt.toLocaleString(),
              estimatedBytes: Buffer.byteLength(
                JSON.stringify(item.factualPayload),
                "utf8",
              ),
            }))}
            maximumCount={descriptor.maximumEvidenceCount}
          />
        </fieldset>
        {!evidence.length && (
          <p className="mt-4 rounded-xl border p-4 text-sm">
            No accessible evidence matches these filters.
          </p>
        )}
      </form>
    </section>
  );
}
