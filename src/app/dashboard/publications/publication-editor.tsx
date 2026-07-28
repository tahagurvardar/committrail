import { ClaimOrderControl } from "./claim-order-control";

interface EditorRepository {
  id: string;
  fullName: string;
  visibility: string;
  claims: Array<{
    id: string;
    statement: string;
    origin: "HUMAN" | "AI_ASSISTED";
    evidence: Array<{
      id: string;
      title: string;
      evidenceType: string;
      occurredAt: string;
    }>;
  }>;
}

interface EditorDefaults {
  trackedRepositoryId: string;
  slug: string;
  internalTitle: string;
  title: string;
  summary: string;
  roleText: string;
  projectPeriodText: string | null;
  technologyLabels: string[];
  problemText: string | null;
  approachText: string | null;
  outcomeText: string | null;
  repositoryDisclosurePolicy: "PUBLIC_REPOSITORY" | "IDENTITY_REDACTED";
  visibility: "PUBLIC" | "UNLISTED";
  firstPublishedAt: Date | null;
  selections: Map<
    string,
    {
      position: number;
      evidence: Map<
        string,
        {
          mode: "PUBLIC_SOURCE" | "SUMMARY_ONLY" | "PRIVATE_SOURCE_REDACTED";
          publicTitle: string | null;
          includeOccurredAt: boolean;
        }
      >;
    }
  >;
}

export function PublicationEditor({
  repositories,
  defaults,
}: {
  repositories: EditorRepository[];
  defaults?: EditorDefaults;
}) {
  return (
    <div className="space-y-6">
      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 font-semibold">Project identity</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm" htmlFor="publication-repository">
            Tracked repository
            <select
              id="publication-repository"
              name="trackedRepositoryId"
              required
              defaultValue={defaults?.trackedRepositoryId ?? ""}
              disabled={Boolean(defaults)}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="">Select a repository</option>
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {repository.fullName} ({repository.visibility})
                </option>
              ))}
            </select>
            {defaults ? (
              <input
                type="hidden"
                name="trackedRepositoryId"
                value={defaults.trackedRepositoryId}
              />
            ) : null}
          </label>
          <label className="text-sm" htmlFor="publication-slug">
            Permanent project slug
            <input
              id="publication-slug"
              name="slug"
              required
              minLength={3}
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              readOnly={Boolean(defaults?.firstPublishedAt)}
              defaultValue={defaults?.slug ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 read-only:bg-muted"
            />
          </label>
          <label className="text-sm" htmlFor="publication-internal-title">
            Private internal title
            <input
              id="publication-internal-title"
              name="internalTitle"
              required
              maxLength={120}
              defaultValue={defaults?.internalTitle ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm" htmlFor="publication-title">
            Public title
            <input
              id="publication-title"
              name="title"
              required
              maxLength={120}
              defaultValue={defaults?.title ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm" htmlFor="publication-role">
            Public role
            <input
              id="publication-role"
              name="roleText"
              required
              maxLength={160}
              defaultValue={defaults?.roleText ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm" htmlFor="publication-period">
            Project period (optional)
            <input
              id="publication-period"
              name="projectPeriodText"
              maxLength={100}
              defaultValue={defaults?.projectPeriodText ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm" htmlFor="publication-technologies">
            Technologies (comma-separated)
            <input
              id="publication-technologies"
              name="technologyLabels"
              defaultValue={defaults?.technologyLabels.join(", ") ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm" htmlFor="publication-visibility">
            Public visibility
            <select
              id="publication-visibility"
              name="visibility"
              defaultValue={defaults?.visibility ?? "UNLISTED"}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="PUBLIC">PUBLIC — may be indexed</option>
              <option value="UNLISTED">
                UNLISTED — anyone with the URL can access
              </option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 font-semibold">Public narrative</legend>
        <div className="space-y-5">
          {[
            ["summary", "Summary", 500, 4, defaults?.summary],
            [
              "problemText",
              "Problem and context (optional)",
              1200,
              5,
              defaults?.problemText,
            ],
            [
              "approachText",
              "Approach (optional)",
              1200,
              5,
              defaults?.approachText,
            ],
            [
              "outcomeText",
              "Outcome and learning (optional)",
              1200,
              5,
              defaults?.outcomeText,
            ],
          ].map(([name, label, maxLength, rows, value]) => (
            <label
              key={String(name)}
              className="block text-sm"
              htmlFor={`publication-${name}`}
            >
              {label}
              <textarea
                id={`publication-${name}`}
                name={String(name)}
                required={name === "summary"}
                maxLength={Number(maxLength)}
                rows={Number(rows)}
                defaultValue={String(value ?? "")}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
          ))}
          <label className="block text-sm" htmlFor="repository-disclosure">
            Repository identity disclosure
            <select
              id="repository-disclosure"
              name="repositoryDisclosurePolicy"
              defaultValue={
                defaults?.repositoryDisclosurePolicy ?? "IDENTITY_REDACTED"
              }
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="IDENTITY_REDACTED">
                Keep repository identity private
              </option>
              <option value="PUBLIC_REPOSITORY">
                Show validated public GitHub repository
              </option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 font-semibold">
          Verified claims and evidence disclosures
        </legend>
        <p className="mb-5 text-sm text-muted-foreground">
          Select at least one eligible claim. For every selected claim, choose
          at least one explicit evidence disclosure. Private evidence is
          redacted by default and is never presented as publicly verifiable.
        </p>
        <div className="space-y-5">
          {repositories.flatMap((repository) =>
            repository.claims.map((claim, claimIndex) => {
              const selected = defaults?.selections.get(claim.id);
              const positionId = `claim-position-${claim.id}`;
              return (
                <article key={claim.id} className="rounded-lg border p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="claimId"
                      value={claim.id}
                      defaultChecked={Boolean(selected)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{claim.statement}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {repository.fullName} · {claim.origin}
                      </span>
                    </span>
                  </label>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs" htmlFor={positionId}>
                      Position
                    </label>
                    <input
                      id={positionId}
                      name={`claimPosition:${claim.id}`}
                      type="number"
                      min={0}
                      max={11}
                      defaultValue={selected?.position ?? claimIndex}
                      className="w-16 rounded border bg-background px-2 py-1 text-sm"
                    />
                    <ClaimOrderControl inputId={positionId} />
                  </div>
                  {claim.origin === "AI_ASSISTED" ? (
                    <p className="mt-3 rounded-md bg-accent p-3 text-xs">
                      Public label: AI-assisted wording, reviewed and verified
                      by the author.
                    </p>
                  ) : null}
                  <ul className="mt-4 space-y-3">
                    {claim.evidence.map((evidence) => {
                      const disclosure = selected?.evidence.get(evidence.id);
                      const privateRepository =
                        repository.visibility.toLowerCase() !== "public";
                      return (
                        <li key={evidence.id} className="rounded-md border p-3">
                          <p className="text-sm font-medium">
                            {evidence.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {evidence.evidenceType} ·{" "}
                            <time dateTime={evidence.occurredAt}>
                              {new Date(
                                evidence.occurredAt,
                              ).toLocaleDateString()}
                            </time>
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="text-xs">
                              Disclosure mode
                              <select
                                name={`disclosureMode:${claim.id}:${evidence.id}`}
                                defaultValue={
                                  disclosure?.mode ??
                                  (privateRepository
                                    ? "PRIVATE_SOURCE_REDACTED"
                                    : "SUMMARY_ONLY")
                                }
                                className="mt-1 w-full rounded border bg-background px-2 py-2 text-sm"
                              >
                                <option value="">Do not disclose</option>
                                {!privateRepository ? (
                                  <option value="PUBLIC_SOURCE">
                                    Public source link
                                  </option>
                                ) : null}
                                {!privateRepository ? (
                                  <option value="SUMMARY_ONLY">
                                    Summary only
                                  </option>
                                ) : null}
                                {privateRepository ? (
                                  <option value="PRIVATE_SOURCE_REDACTED">
                                    Private source redacted
                                  </option>
                                ) : null}
                              </select>
                            </label>
                            <label className="text-xs">
                              Approved public title
                              <input
                                name={`publicTitle:${claim.id}:${evidence.id}`}
                                maxLength={160}
                                defaultValue={disclosure?.publicTitle ?? ""}
                                placeholder={
                                  privateRepository
                                    ? "Optional generic description"
                                    : evidence.title
                                }
                                className="mt-1 w-full rounded border bg-background px-2 py-2 text-sm"
                              />
                            </label>
                          </div>
                          <label className="mt-3 flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              name={`includeDate:${claim.id}:${evidence.id}`}
                              value="yes"
                              defaultChecked={
                                disclosure?.includeOccurredAt ?? true
                              }
                            />
                            Include evidence date
                          </label>
                          {privateRepository ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              The repository name, URL, branch, SHA, source
                              number, private title, and GitHub identity are
                              never included.
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            }),
          )}
        </div>
      </fieldset>
    </div>
  );
}
