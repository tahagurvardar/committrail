import { Panel } from "@/components/demo/panel";
import { EmptyState } from "@/components/empty-state";
import { ReleaseIcon } from "@/components/icons";
import type { DemoRelease } from "@/lib/demo/types";
import { formatDate } from "@/lib/format";

export function ReleasePanel({
  releases,
  repoName,
}: {
  releases: readonly DemoRelease[];
  repoName: string;
}) {
  return (
    <Panel
      title="Release activity"
      description="Tagged versions ingested as release evidence."
    >
      {releases.length === 0 ? (
        <EmptyState
          icon={ReleaseIcon}
          title="No releases ingested yet"
          description={`${repoName} has not published a tagged release. Claims for this repository draw on commits, pull requests, and workflow runs instead.`}
        />
      ) : (
        <ul className="divide-y divide-border">
          {releases.map((release) => (
            <li
              key={release.version}
              className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">
                  {release.version}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {release.title}
                </p>
              </div>
              <time
                dateTime={release.date}
                className="shrink-0 font-mono text-xs text-muted-foreground"
              >
                {formatDate(release.date)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
