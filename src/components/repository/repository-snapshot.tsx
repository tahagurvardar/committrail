import Image from "next/image";
import Link from "next/link";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { EmptyState } from "@/components/empty-state";
import {
  ArrowRightIcon,
  BookIcon,
  ExternalLinkIcon,
  ShieldIcon,
} from "@/components/icons";
import { LanguageDistribution } from "@/components/repository/language-distribution";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PublicRepositorySnapshot } from "@/lib/github/types";
import { formatCount, formatDateFlexible, formatDateTime } from "@/lib/format";

const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-sm">{value}</dd>
    </div>
  );
}

/**
 * Read-only Phase 1 snapshot of a public repository. Everything shown is a
 * direct GitHub fact—no scoring or inferred quality. Activity is rendered by
 * the separate Phase 1B component.
 */
export function RepositorySnapshot({
  snapshot,
}: {
  snapshot: PublicRepositorySnapshot;
}) {
  const { identity, readme } = snapshot;

  return (
    <article aria-labelledby="snapshot-heading" className="space-y-10">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            {snapshot.ownerAvatarUrl ? (
              <Image
                src={snapshot.ownerAvatarUrl}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-lg border border-border bg-card"
              />
            ) : null}
            <div className="min-w-0">
              <h1
                id="snapshot-heading"
                className="text-2xl font-semibold tracking-tight break-words sm:text-3xl"
              >
                <span className="text-muted-foreground">{identity.owner}</span>
                <span className="text-muted-foreground"> / </span>
                {identity.name}
              </h1>
              {snapshot.description ? (
                <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
                  {snapshot.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={identity.url}
              {...EXTERNAL_LINK_PROPS}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <ExternalLinkIcon className="size-4" />
              View on GitHub
            </a>
            {snapshot.homepage ? (
              <a
                href={snapshot.homepage}
                {...EXTERNAL_LINK_PROPS}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLinkIcon className="size-4" />
                Homepage
              </a>
            ) : null}
          </div>
        </div>

        <ul
          aria-label="Repository status"
          className="mt-4 flex flex-wrap gap-2"
        >
          <li>
            <Badge className="border-primary/50 bg-primary/10 text-primary">
              <ShieldIcon />
              Public
            </Badge>
          </li>
          {snapshot.archived ? (
            <li>
              <Badge className="border-amber-600/50 bg-amber-500/15 text-amber-900 dark:border-amber-300/40 dark:text-amber-200">
                Archived
              </Badge>
            </li>
          ) : null}
          {snapshot.fork ? (
            <li>
              <Badge variant="soft">Fork</Badge>
            </li>
          ) : null}
          {snapshot.isTemplate ? (
            <li>
              <Badge variant="soft">Template</Badge>
            </li>
          ) : null}
        </ul>

        <p className="mt-5 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">
            Live public repository evidence.
          </strong>{" "}
          Real public GitHub data: repository metadata, languages, a safe README
          excerpt, and bounded recent activity evidence. The full future product
          is previewed in the{" "}
          <Link
            href="/demo"
            className="text-primary underline underline-offset-2"
          >
            synthetic demo
          </Link>
          .
        </p>
      </header>

      <section aria-labelledby="facts-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="facts-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Repository facts
          </h2>
          <ConfidenceBadge state="fact" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Stars" value={formatCount(snapshot.stars)} />
          <MetricCard label="Forks" value={formatCount(snapshot.forks)} />
          <MetricCard
            label="Open issues"
            value={formatCount(snapshot.openIssues)}
          />
          {snapshot.subscribers !== null ? (
            <MetricCard
              label="Watchers"
              value={formatCount(snapshot.subscribers)}
            />
          ) : null}
        </div>
        <Card className="mt-3 px-4 py-1.5">
          <dl>
            <FactRow label="Default branch" value={snapshot.defaultBranch} />
            <FactRow
              label="License"
              value={
                snapshot.license
                  ? (snapshot.license.spdxId ?? snapshot.license.name)
                  : "None detected"
              }
            />
            <FactRow
              label="Created"
              value={
                <time dateTime={snapshot.createdAt}>
                  {formatDateFlexible(snapshot.createdAt)}
                </time>
              }
            />
            <FactRow
              label="Updated"
              value={
                <time dateTime={snapshot.updatedAt}>
                  {formatDateFlexible(snapshot.updatedAt)}
                </time>
              }
            />
            <FactRow
              label="Last pushed"
              value={
                snapshot.pushedAt ? (
                  <time dateTime={snapshot.pushedAt}>
                    {formatDateFlexible(snapshot.pushedAt)}
                  </time>
                ) : (
                  "Not reported"
                )
              }
            />
          </dl>
        </Card>
        {snapshot.topics.length > 0 ? (
          <ul aria-label="Topics" className="mt-3 flex flex-wrap gap-1.5">
            {snapshot.topics.map((topic) => (
              <li key={topic}>
                <Badge variant="soft" className="font-mono text-[11px]">
                  {topic}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="languages-heading">
        <h2
          id="languages-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Language distribution
        </h2>
        <div className="mt-4">
          <LanguageDistribution languages={snapshot.languages} />
        </div>
      </section>

      <section aria-labelledby="readme-heading">
        <h2
          id="readme-heading"
          className="text-lg font-semibold tracking-tight"
        >
          README
        </h2>
        <div className="mt-4">
          {readme.present ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-sm">
                  {readme.path ?? "README"}{" "}
                  <span className="text-muted-foreground">detected</span>
                </p>
                {readme.htmlUrl ? (
                  <a
                    href={readme.htmlUrl}
                    {...EXTERNAL_LINK_PROPS}
                    className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
                  >
                    Read the full README on GitHub
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                ) : null}
              </div>
              {readme.excerpt ? (
                <blockquote className="mt-4 border-l-2 border-rail pl-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {readme.excerpt}
                </blockquote>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  A safe plain-text excerpt is not available — read the README
                  on GitHub.
                </p>
              )}
              {readme.excerpt && readme.truncated ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Plain-text excerpt only — formatting, images, and the rest of
                  the document live on GitHub.
                </p>
              ) : null}
            </Card>
          ) : (
            <EmptyState
              icon={BookIcon}
              title="No README detected"
              description="Not every repository ships a README — this is a normal state, recorded as a fact."
            />
          )}
        </div>
      </section>

      <section
        aria-labelledby="disclosure-heading"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h2
          id="disclosure-heading"
          className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase"
        >
          Data source
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            Read directly from the GitHub REST API over read-only, public-data
            access. CommitTrail never writes to GitHub.
          </li>
          <li>
            Snapshot generated{" "}
            <time dateTime={snapshot.fetchedAt} className="font-mono">
              {formatDateTime(snapshot.fetchedAt)}
            </time>
            . Snapshots are cached briefly, so data may be delayed by a few
            minutes — this is not a real-time view.
          </li>
          <li>
            Facts are shown without interpretation: no scoring, no ranking, no
            conclusions about quality or activity.
          </li>
        </ul>
        <Link
          href="/methodology"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
        >
          How CommitTrail treats evidence
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </section>
    </article>
  );
}
