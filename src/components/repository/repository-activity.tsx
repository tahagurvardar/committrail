import { Fragment } from "react";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { ExternalLinkIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  buildRecentTimeline,
  deriveIssueStates,
  derivePullRequestStates,
  deriveReleaseInterval,
  deriveWorkflowOutcomes,
  type DerivationMetadata,
} from "@/lib/github/activity-derivations";
import type {
  ActivityEvidence,
  ActivitySection,
  CommitEvidence,
  IssueEvidence,
  PublicRepositoryActivity,
  PullRequestEvidence,
  ReleaseEvidence,
  WorkflowRunEvidence,
} from "@/lib/github/activity-types";
import { formatDateTime } from "@/lib/format";

const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noreferrer noopener",
} as const;

export function RepositoryActivity({
  activity,
}: {
  activity: PublicRepositoryActivity;
}) {
  const timeline = buildRecentTimeline([
    availableItems(activity.commits),
    availableItems(activity.pullRequests),
    availableItems(activity.issues),
    availableItems(activity.releases),
    availableItems(activity.workflowRuns),
  ]);
  const summaries = [
    activity.workflowRuns.status === "available"
      ? deriveWorkflowOutcomes(activity.workflowRuns.items)
      : null,
    activity.releases.status === "available"
      ? deriveReleaseInterval(activity.releases.items)
      : null,
    activity.issues.status === "available"
      ? deriveIssueStates(activity.issues.items)
      : null,
    activity.pullRequests.status === "available"
      ? derivePullRequestStates(activity.pullRequests.items)
      : null,
  ].filter((summary) => summary !== null);

  return (
    <section
      aria-labelledby="activity-heading"
      className="mt-12 space-y-8 border-t border-border pt-10"
    >
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="activity-heading"
            className="text-2xl font-bold tracking-tight"
          >
            Public activity evidence
          </h2>
          <ConfidenceBadge state="fact" />
        </div>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          A bounded, read-only sample of records recently returned by GitHub. It
          is not a complete repository history, and counts are not measures of
          productivity or quality.
        </p>
      </header>

      <section aria-labelledby="activity-overview-heading">
        <h3
          id="activity-overview-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Activity overview
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <OverviewCard label="Commits" section={activity.commits} />
          <OverviewCard label="Pull requests" section={activity.pullRequests} />
          <OverviewCard label="Standalone issues" section={activity.issues} />
          <OverviewCard
            label="Published releases"
            section={activity.releases}
          />
          <OverviewCard label="Workflow runs" section={activity.workflowRuns} />
        </div>
      </section>

      <section aria-labelledby="timeline-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h3
            id="timeline-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Unified recent timeline
          </h3>
          <ConfidenceBadge state="fact" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Up to 30 records from the five fetched recent windows, ordered by
          their factual occurrence timestamp.
        </p>
        {timeline.length === 0 ? (
          <Card
            role="status"
            className="mt-4 p-5 text-sm text-muted-foreground"
          >
            No available activity records were returned in this recent sample.
          </Card>
        ) : (
          <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
            {timeline.map((record) => (
              <li
                key={record.evidenceId}
                className="flex min-w-0 flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="soft">{typeLabel(record)}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {sourceReference(record)}
                    </span>
                  </div>
                  <a
                    href={record.sourceUrl}
                    {...EXTERNAL_LINK_PROPS}
                    className="mt-2 block font-medium break-words underline-offset-2 hover:text-primary hover:underline"
                    aria-label={`${record.title} on GitHub`}
                  >
                    {record.title}
                  </a>
                </div>
                <time
                  dateTime={record.occurredAt}
                  className="shrink-0 font-mono text-xs text-muted-foreground"
                >
                  {formatDateTime(record.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="summaries-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h3
            id="summaries-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Deterministic sampled summaries
          </h3>
          <ConfidenceBadge state="deterministic" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Reproducible arithmetic over fetched facts only—no score, ranking,
          hidden weight, or generated interpretation.
        </p>
        {summaries.length === 0 ? (
          <Card className="mt-4 p-5 text-sm text-muted-foreground">
            No summary has an available or adequate sample right now.
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {summaries.map((summary) => (
              <SummaryCard key={summary.label} summary={summary} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="categories-heading">
        <h3
          id="categories-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Activity by source
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Expand a category to inspect its returned records and pagination
          disclosure.
        </p>
        <div className="mt-4 space-y-3">
          <ActivityCategory
            id="recent-commits"
            label="Recent commits"
            emptyLabel="No recent commits"
            section={activity.commits}
            categoryUrl={activity.categoryUrls.commits}
            renderItem={(item) => <CommitRow item={item} />}
          />
          <ActivityCategory
            id="recent-pull-requests"
            label="Pull requests"
            emptyLabel="No recent pull requests"
            section={activity.pullRequests}
            categoryUrl={activity.categoryUrls.pullRequests}
            renderItem={(item) => <PullRequestRow item={item} />}
          />
          <ActivityCategory
            id="recent-issues"
            label="Standalone issues"
            emptyLabel="No standalone issues"
            section={activity.issues}
            categoryUrl={activity.categoryUrls.issues}
            renderItem={(item) => <IssueRow item={item} />}
          />
          <ActivityCategory
            id="recent-releases"
            label="Published releases"
            emptyLabel="No published releases"
            section={activity.releases}
            categoryUrl={activity.categoryUrls.releases}
            renderItem={(item) => <ReleaseRow item={item} />}
          />
          <ActivityCategory
            id="recent-workflow-runs"
            label="Workflow runs"
            emptyLabel="No workflow runs"
            section={activity.workflowRuns}
            categoryUrl={activity.categoryUrls.workflowRuns}
            renderItem={(item) => <WorkflowRunRow item={item} />}
          />
        </div>
      </section>

      <aside
        aria-label="Activity source and pagination disclosure"
        className="rounded-xl border border-border bg-surface p-5 text-sm leading-relaxed text-muted-foreground"
      >
        <strong className="font-medium text-foreground">
          Source and limits.
        </strong>{" "}
        GitHub REST API, read-only public records. CommitTrail requests only
        page 1: up to 20 commits, 20 pull requests, 20 issue-endpoint records,
        10 releases, and 20 workflow runs. GitHub’s issue endpoint also returns
        pull requests, which are removed before standalone issues are shown.
        Pagination links are inspected only to disclose whether more may exist;
        they are never followed or exposed.
        <span className="mt-2 block">
          Activity fetched{" "}
          <time dateTime={activity.fetchedAt}>
            {formatDateTime(activity.fetchedAt)}
          </time>
          . Fully available activity may be cached for about five minutes;
          partial failures are not cached.
        </span>
      </aside>
    </section>
  );
}

function OverviewCard<T>({
  label,
  section,
}: {
  label: string;
  section: ActivitySection<T>;
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">
        {section.status === "available"
          ? section.pagination.returnedCount
          : "Unavailable"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {section.status === "available"
          ? `of up to ${section.pagination.sampleLimit} returned`
          : unavailableLabel(section.reason)}
      </p>
    </Card>
  );
}

function SummaryCard({
  summary,
}: {
  summary:
    | ReturnType<typeof deriveWorkflowOutcomes>
    | NonNullable<ReturnType<typeof deriveReleaseInterval>>
    | ReturnType<typeof deriveIssueStates>
    | ReturnType<typeof derivePullRequestStates>;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-semibold">{summary.label}</h4>
        <ConfidenceBadge state="deterministic" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{summaryValue(summary)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Sample size: {summary.sampleSize}
      </p>
      <DerivationDisclosure summary={summary} />
    </Card>
  );
}

function DerivationDisclosure({ summary }: { summary: DerivationMetadata }) {
  return (
    <details className="mt-4 text-sm text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Definition and limitation
      </summary>
      <p className="mt-2">{summary.definition}</p>
      <p className="mt-2">{summary.limitation}</p>
      <p className="mt-2 font-mono text-xs">
        Source: {summary.sourceRecordTypes.join(", ")}
      </p>
    </details>
  );
}

function summaryValue(
  summary:
    | ReturnType<typeof deriveWorkflowOutcomes>
    | NonNullable<ReturnType<typeof deriveReleaseInterval>>
    | ReturnType<typeof deriveIssueStates>
    | ReturnType<typeof derivePullRequestStates>,
): string {
  if ("completedSuccessPercent" in summary) {
    return summary.completedSuccessPercent === null
      ? `0 completed; ${summary.inProgressOrQueuedCount} queued or in progress`
      : `${summary.successfulCount}/${summary.completedCount} completed successful (${summary.completedSuccessPercent}%)`;
  }
  if ("medianDays" in summary) {
    return `${summary.medianDays} days`;
  }
  if ("draftCount" in summary) {
    return `${summary.openCount} open · ${summary.closedCount} closed · ${summary.draftCount} draft · ${summary.mergedCount} merged`;
  }
  return `${summary.openCount} open · ${summary.closedCount} closed`;
}

function ActivityCategory<T extends ActivityEvidence>({
  id,
  label,
  emptyLabel,
  section,
  categoryUrl,
  renderItem,
}: {
  id: string;
  label: string;
  emptyLabel: string;
  section: ActivitySection<T>;
  categoryUrl: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 marker:hidden">
        <h4 id={id} className="font-semibold">
          {label}
        </h4>
        <span className="text-sm text-muted-foreground">
          {section.status === "available"
            ? `${section.pagination.returnedCount} returned`
            : "Unavailable"}
        </span>
      </summary>
      <div className="border-t border-border p-4">
        {section.status === "unavailable" ? (
          <UnavailableState section={section} />
        ) : section.items.length === 0 ? (
          <div role="status" className="rounded-lg bg-surface p-4">
            <p className="font-medium">{emptyLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No records were returned in this recent sample. This does not
              prove the repository has never had this activity.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {section.items.map((item) => (
              <Fragment key={item.evidenceId}>{renderItem(item)}</Fragment>
            ))}
          </ul>
        )}
        {section.status === "available" ? (
          <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
            <p>
              Showing {section.pagination.returnedCount} of up to{" "}
              {section.pagination.sampleLimit} most recently returned records.
              {section.pagination.hasMore
                ? " More activity may exist on GitHub."
                : " GitHub did not advertise a next page, but this remains a bounded sample."}
            </p>
            {section.discardedRecordCount > 0 ? (
              <p role="status" className="mt-2">
                {section.discardedRecordCount} malformed{" "}
                {section.discardedRecordCount === 1
                  ? "record was"
                  : "records were"}{" "}
                omitted.
              </p>
            ) : null}
            <a
              href={categoryUrl}
              {...EXTERNAL_LINK_PROPS}
              className="mt-3 inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
              aria-label={`View ${label.toLowerCase()} on GitHub`}
            >
              View this category on GitHub
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function UnavailableState({
  section,
}: {
  section: Extract<ActivitySection<unknown>, { status: "unavailable" }>;
}) {
  return (
    <div role="status" className="rounded-lg bg-surface p-4">
      <p className="font-medium">This activity source is unavailable.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {unavailableDescription(section.reason)}
      </p>
      {section.retryAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          GitHub indicated retry availability around{" "}
          <time dateTime={section.retryAt}>
            {formatDateTime(section.retryAt)}
          </time>
          .
        </p>
      ) : null}
    </div>
  );
}

function CommitRow({ item }: { item: CommitEvidence }) {
  return (
    <RecordRow item={item} meta={`${item.shortSha} · ${authorLabel(item)}`}>
      {item.verification ? (
        <Badge variant="soft">{item.verification}</Badge>
      ) : null}
    </RecordRow>
  );
}

function PullRequestRow({ item }: { item: PullRequestEvidence }) {
  const state = item.mergedAt ? "merged" : item.draft ? "draft" : item.state;
  return (
    <RecordRow
      item={item}
      meta={`#${item.number} · ${item.headBranch} → ${item.baseBranch}`}
    >
      <Badge variant="soft">{state}</Badge>
    </RecordRow>
  );
}

function IssueRow({ item }: { item: IssueEvidence }) {
  return (
    <RecordRow
      item={item}
      meta={`#${item.number} · ${item.commentCount} comments`}
    >
      <Badge variant="soft">{item.stateReason ?? item.state}</Badge>
      {item.labels.slice(0, 3).map((label) => (
        <Badge key={label.name} variant="outline">
          {label.name}
        </Badge>
      ))}
    </RecordRow>
  );
}

function ReleaseRow({ item }: { item: ReleaseEvidence }) {
  return (
    <RecordRow item={item} meta={`${item.tagName} · ${item.assetCount} assets`}>
      {item.prerelease ? <Badge variant="soft">prerelease</Badge> : null}
      {item.immutable ? <Badge variant="soft">immutable</Badge> : null}
    </RecordRow>
  );
}

function WorkflowRunRow({ item }: { item: WorkflowRunEvidence }) {
  return (
    <RecordRow item={item} meta={`Run #${item.runNumber} · ${item.event}`}>
      <Badge variant="soft">{item.conclusion ?? item.status}</Badge>
    </RecordRow>
  );
}

function RecordRow({
  item,
  meta,
  children,
}: {
  item: ActivityEvidence;
  meta: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <a
          href={item.sourceUrl}
          {...EXTERNAL_LINK_PROPS}
          className="block font-medium break-words underline-offset-2 hover:text-primary hover:underline"
          aria-label={`${item.title} on GitHub`}
        >
          {item.title}
        </a>
        <p className="mt-1 font-mono text-xs break-words text-muted-foreground">
          {meta}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {children}
        <time
          dateTime={item.occurredAt}
          className="font-mono text-xs text-muted-foreground"
        >
          {formatDateTime(item.occurredAt)}
        </time>
      </div>
    </li>
  );
}

function availableItems<T>(section: ActivitySection<T>): T[] {
  return section.status === "available" ? section.items : [];
}

function authorLabel(item: CommitEvidence): string {
  return item.authorLogin
    ? `@${item.authorLogin}`
    : (item.authorDisplayName ?? "Unknown author");
}

function typeLabel(record: ActivityEvidence): string {
  return {
    commit: "Commit",
    "pull-request": "Pull request",
    issue: "Issue",
    release: "Release",
    "workflow-run": "Workflow run",
  }[record.evidenceType];
}

function sourceReference(record: ActivityEvidence): string {
  if (record.evidenceType === "commit") {
    return record.shortSha;
  }
  if (
    record.evidenceType === "pull-request" ||
    record.evidenceType === "issue"
  ) {
    return `#${record.number}`;
  }
  if (record.evidenceType === "release") {
    return record.tagName;
  }
  return `run ${record.runNumber}`;
}

function unavailableLabel(
  reason: Extract<
    ActivitySection<unknown>,
    { status: "unavailable" }
  >["reason"],
): string {
  return {
    "rate-limited": "Rate limited",
    "upstream-unavailable": "GitHub unavailable",
    timeout: "Request timed out",
    "malformed-response": "Response validation failed",
    "not-supported": "Not available for this repository",
  }[reason];
}

function unavailableDescription(
  reason: Extract<
    ActivitySection<unknown>,
    { status: "unavailable" }
  >["reason"],
): string {
  return {
    "rate-limited":
      "GitHub rate-limited this source. Other available sections remain factual.",
    "upstream-unavailable":
      "GitHub was temporarily unavailable for this source.",
    timeout: "GitHub did not return this source before the bounded timeout.",
    "malformed-response":
      "The response did not pass runtime validation, so no records were invented.",
    "not-supported":
      "GitHub did not make this source available for the repository.",
  }[reason];
}
