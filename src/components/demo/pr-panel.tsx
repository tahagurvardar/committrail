import { Panel } from "@/components/demo/panel";
import type { DemoPullRequest } from "@/lib/demo/types";
import { formatCount, formatDate } from "@/lib/format";

export function PullRequestPanel({
  pullRequests,
  totalIngested,
}: {
  pullRequests: readonly DemoPullRequest[];
  totalIngested: number;
}) {
  return (
    <Panel
      title="Pull request activity"
      description={`Most recently merged of ${formatCount(totalIngested)} ingested pull requests.`}
    >
      <ul className="divide-y divide-border">
        {pullRequests.map((pullRequest) => (
          <li
            key={pullRequest.number}
            className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                #{pullRequest.number}
              </span>
              <p className="truncate text-sm">{pullRequest.title}</p>
            </div>
            <time
              dateTime={pullRequest.mergedOn}
              className="shrink-0 font-mono text-xs text-muted-foreground"
            >
              {formatDate(pullRequest.mergedOn)}
            </time>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
