import Link from "next/link";
import type { PublicProjectView } from "@/lib/publishing/types";

export function PublicProject({
  project,
  preview = false,
}: {
  project: PublicProjectView;
  preview?: boolean;
}) {
  return (
    <article className="container-page py-10">
      {preview ? (
        <aside
          aria-label="Unpublished preview"
          className="mb-6 rounded-xl border bg-accent p-4 text-sm"
        >
          <strong>Unpublished preview.</strong> This uses the exact public view
          model and renderer. It is private, no-store, and never indexed.
          Visibility: {project.visibility}. Robots:{" "}
          {project.visibility === "PUBLIC"
            ? "index, follow"
            : "noindex, follow"}
          .
        </aside>
      ) : null}
      <header className="border-b pb-8">
        <Link
          href={`/profiles/${project.author.slug}`}
          className="text-sm text-primary underline"
        >
          {project.author.displayName}
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {project.title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
          {project.summary}
        </p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Role</dt>
            <dd className="text-muted-foreground">{project.role}</dd>
          </div>
          {project.period ? (
            <div>
              <dt className="font-medium">Period</dt>
              <dd className="text-muted-foreground">{project.period}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium">Published revision</dt>
            <dd className="text-muted-foreground">
              {project.revisionNumber} ·{" "}
              <time dateTime={project.publishedAt}>
                {new Date(project.publishedAt).toLocaleDateString()}
              </time>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Visibility</dt>
            <dd className="text-muted-foreground">{project.visibility}</dd>
          </div>
        </dl>
        {project.technologies.length ? (
          <ul
            aria-label="Technologies"
            className="mt-5 flex flex-wrap gap-2 text-sm"
          >
            {project.technologies.map((technology) => (
              <li key={technology} className="rounded-full border px-3 py-1">
                {technology}
              </li>
            ))}
          </ul>
        ) : null}
        {project.publicRepositoryUrl && project.publicRepositoryLabel ? (
          <a
            href={project.publicRepositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block text-sm text-primary underline"
          >
            View public source repository: {project.publicRepositoryLabel}
          </a>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            Repository identity is not included in this publication.
          </p>
        )}
      </header>

      <div className="grid gap-8 py-8 lg:grid-cols-3">
        {[
          ["Problem and context", project.problem],
          ["Approach", project.approach],
          ["Outcome and learning", project.outcome],
        ].map(([title, body]) =>
          body ? (
            <section key={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
                {body}
              </p>
            </section>
          ) : null,
        )}
      </div>

      {project.healthNotice ? (
        <aside className="rounded-xl border p-4 text-sm" role="status">
          {project.healthNotice}
        </aside>
      ) : null}

      <section className="mt-8" aria-labelledby="reviewed-claims">
        <h2 id="reviewed-claims" className="text-2xl font-semibold">
          Reviewed claims and evidence
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          These claims were reviewed and verified by the author. CommitTrail
          preserves their evidence trail; it does not independently certify
          objective truth.
        </p>
        <ol className="mt-6 space-y-6">
          {project.claims.map((claim) => (
            <li
              key={claim.identifier}
              className="rounded-xl border bg-card p-5"
            >
              <p className="font-medium">{claim.statement}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Author verified{" "}
                <time dateTime={claim.verifiedAt}>
                  {new Date(claim.verifiedAt).toLocaleDateString()}
                </time>
              </p>
              {claim.aiAssistedDisclosure ? (
                <p className="mt-2 rounded-md bg-accent p-3 text-sm">
                  {claim.aiAssistedDisclosure}
                </p>
              ) : null}
              <h3 className="mt-5 font-medium">Evidence disclosures</h3>
              <ul className="mt-3 space-y-3">
                {claim.evidence.map((evidence) => (
                  <li
                    key={evidence.identifier}
                    className="rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border px-2 py-0.5">
                        Fact
                      </span>
                      <span>{evidence.type}</span>
                      {evidence.occurredAt ? (
                        <time dateTime={evidence.occurredAt}>
                          {new Date(evidence.occurredAt).toLocaleDateString()}
                        </time>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm">{evidence.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {evidence.provenance}
                    </p>
                    {evidence.sourceUrl ? (
                      <a
                        href={evidence.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-primary underline"
                      >
                        Inspect the public GitHub source
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
      <footer className="mt-10 border-t pt-6 text-sm text-muted-foreground">
        Evidence-first publishing through CommitTrail. Structural grounding is
        provenance, not an independent truth score.
      </footer>
    </article>
  );
}
