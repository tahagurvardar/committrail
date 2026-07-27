import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ExploreForm } from "@/components/explore/explore-form";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { ProductBadge } from "@/components/product-badge";
import { parseRepositoryInput } from "@/lib/github/parse-repository-input";

export const metadata: Metadata = {
  title: "Explore a public repository",
  description:
    "Fetch a read-only snapshot and bounded recent activity evidence for any public GitHub repository.",
};

const EXAMPLES = [
  { label: "vercel/next.js", owner: "vercel", repo: "next.js" },
  { label: "facebook/react", owner: "facebook", repo: "react" },
] as const;

const ASSURANCES = [
  "Read-only: CommitTrail only reads public data and can never write to GitHub.",
  "No account, sign-in, or GitHub App installation is required.",
  "Nothing you enter is stored — the input is parsed into owner/repository and only that pair is used.",
] as const;

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw =
    typeof params.repository === "string" ? params.repository : undefined;

  let serverError: string | undefined;
  if (raw !== undefined) {
    const result = parseRepositoryInput(raw);
    if (result.ok) {
      redirect(`/repositories/${result.value.owner}/${result.value.repo}`);
    }
    serverError = result.error.message;
  }

  return (
    <div className="container-page py-14 sm:py-20">
      <div className="max-w-2xl">
        <ProductBadge />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Snapshot a public repository.
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Enter any public GitHub repository and CommitTrail fetches a read-only
          snapshot of its metadata, languages, README, and bounded recent
          activity evidence—real data, clearly separated from the synthetic
          demo.
        </p>
      </div>

      <div className="mt-10">
        <ExploreForm defaultValue={raw ?? ""} serverError={serverError} />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <Link
              key={example.label}
              href={`/repositories/${example.owner}/${example.repo}`}
              className="rounded-sm font-mono text-primary underline-offset-2 hover:underline"
            >
              {example.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldIcon className="size-4 text-primary" />
            What this does — and doesn’t
          </h2>
          <ul className="mt-4 space-y-3">
            {ASSURANCES.map((assurance) => (
              <li
                key={assurance}
                className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                {assurance}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-semibold tracking-tight">Good to know</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              Accepted forms:{" "}
              <code className="font-mono text-foreground">
                owner/repository
              </code>{" "}
              or{" "}
              <code className="font-mono text-foreground">
                https://github.com/owner/repository
              </code>{" "}
              (trailing <code className="font-mono">/</code> or{" "}
              <code className="font-mono">.git</code> is fine).
            </li>
            <li>
              Without an optional server token, requests use GitHub’s shared
              anonymous rate limit. If GitHub rate-limits the site, the page
              reports only the retry timing GitHub actually provides — nothing
              is fabricated.
            </li>
            <li>
              Fully available snapshots and activity are cached briefly, so data
              may be delayed by a few minutes. Partial activity failures are not
              cached.
            </li>
            <li>
              Phase 1B scope adds page-one samples of commits, pull requests,
              standalone issues, published releases, and workflow runs. It is
              not complete history and never measures productivity or quality.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
