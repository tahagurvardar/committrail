import { Panel } from "@/components/demo/panel";
import type { WorkflowSummary } from "@/lib/demo/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CiPanel({
  workflows,
}: {
  workflows: readonly WorkflowSummary[];
}) {
  return (
    <Panel
      title="CI and test evidence"
      description="Workflow runs are the strongest source for quality and performance claims."
    >
      <ul className="space-y-4">
        {workflows.map((workflow) => {
          const rate = Math.round(
            (workflow.passed / workflow.runsSampled) * 100,
          );
          return (
            <li key={workflow.name}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-mono text-sm font-medium">{workflow.name}</p>
                <p className="font-mono text-xs text-muted-foreground tabular-nums">
                  {rate}% passing
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {workflow.passed} of {workflow.runsSampled} recent runs passed
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full",
                    workflow.lastRun.passed ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                Latest: run #{workflow.lastRun.id} ·{" "}
                {formatDate(workflow.lastRun.date)} ·{" "}
                {workflow.lastRun.passed ? "passed" : "failed"}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
