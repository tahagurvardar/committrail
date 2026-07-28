import { ClaimOrderControl } from "@/app/dashboard/publications/claim-order-control";

interface OutputEditorRepository {
  id: string;
  fullName: string;
  claims: Array<{
    id: string;
    statement: string;
    origin: "HUMAN" | "AI_ASSISTED";
  }>;
}

interface OutputDefaults {
  trackedRepositoryId: string;
  type: "CASE_STUDY" | "CV_BULLETS" | "INTERVIEW_STORY";
  title: string;
  fields: Record<string, unknown>;
  claims: Map<string, { position: number; statementOverride: string | null }>;
}

export function OutputEditor({
  repositories,
  defaults,
}: {
  repositories: OutputEditorRepository[];
  defaults?: OutputDefaults;
}) {
  return (
    <div className="space-y-6">
      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 font-semibold">Output configuration</legend>
        <div className="grid gap-5 md:grid-cols-3">
          <label className="text-sm" htmlFor="output-repository">
            Repository
            <select
              id="output-repository"
              name="trackedRepositoryId"
              required
              disabled={Boolean(defaults)}
              defaultValue={defaults?.trackedRepositoryId ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="">Select repository</option>
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {repository.fullName}
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
          <label className="text-sm" htmlFor="output-type">
            Deterministic template
            <select
              id="output-type"
              name="type"
              disabled={Boolean(defaults)}
              defaultValue={defaults?.type ?? "CASE_STUDY"}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="CASE_STUDY">Case study</option>
              <option value="CV_BULLETS">CV bullets</option>
              <option value="INTERVIEW_STORY">Interview story</option>
            </select>
            {defaults ? (
              <input type="hidden" name="type" value={defaults.type} />
            ) : null}
          </label>
          <label className="text-sm" htmlFor="output-title">
            Private output title
            <input
              id="output-title"
              name="title"
              required
              maxLength={120}
              defaultValue={defaults?.title ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 font-semibold">Case-study fields</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["projectTitle", "Project title"],
            ["overview", "Overview"],
            ["context", "Context and problem"],
            ["role", "Role"],
            ["approach", "Approach"],
            ["outcomes", "Outcomes"],
            ["learning", "Challenges and learning"],
            ["limitations", "Limitations and disclosures"],
          ].map(([name, label]) => (
            <label key={name} className="text-sm" htmlFor={`output-${name}`}>
              {label}
              <textarea
                id={`output-${name}`}
                name={name}
                rows={3}
                maxLength={1500}
                defaultValue={String(defaults?.fields[name] ?? "")}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 font-semibold">Interview story fields</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {["situation", "task", "action", "result", "reflection"].map(
            (name) => (
              <label
                key={name}
                className="text-sm capitalize"
                htmlFor={`output-${name}`}
              >
                {name}
                <textarea
                  id={`output-${name}`}
                  name={name}
                  rows={3}
                  maxLength={1500}
                  defaultValue={String(defaults?.fields[name] ?? "")}
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
            ),
          )}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 font-semibold">Ordered verified claims</legend>
        <p className="mb-4 text-sm text-muted-foreground">
          CV bullets use 1–6 exact reviewed claims or your bounded plain-text
          variants. Other templates accept up to 12. No metrics, impact, or
          connecting prose is invented.
        </p>
        <div className="space-y-4">
          {repositories.flatMap((repository) =>
            repository.claims.map((claim, claimIndex) => {
              const selected = defaults?.claims.get(claim.id);
              const inputId = `output-claim-position-${claim.id}`;
              return (
                <article key={claim.id} className="rounded-md border p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="claimId"
                      value={claim.id}
                      defaultChecked={Boolean(selected)}
                      className="mt-1"
                    />
                    <span>
                      {claim.statement}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {repository.fullName} · {claim.origin}
                      </span>
                    </span>
                  </label>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs" htmlFor={inputId}>
                      Position
                    </label>
                    <input
                      id={inputId}
                      type="number"
                      min={0}
                      max={11}
                      name={`claimPosition:${claim.id}`}
                      defaultValue={selected?.position ?? claimIndex}
                      className="w-16 rounded border bg-background px-2 py-1 text-sm"
                    />
                    <ClaimOrderControl inputId={inputId} />
                  </div>
                  <label className="mt-3 block text-xs">
                    Optional reviewed CV/plain-text variant
                    <textarea
                      name={`statementOverride:${claim.id}`}
                      maxLength={500}
                      rows={2}
                      defaultValue={selected?.statementOverride ?? ""}
                      className="mt-1 w-full rounded border bg-background px-2 py-2 text-sm"
                    />
                  </label>
                </article>
              );
            }),
          )}
        </div>
      </fieldset>
    </div>
  );
}
