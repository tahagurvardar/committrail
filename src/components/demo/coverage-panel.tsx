import { Panel } from "@/components/demo/panel";
import { COVERAGE_MIN_EVIDENCE, evidenceCoverage } from "@/lib/demo/derive";
import type { Milestone } from "@/lib/demo/types";

/** Evidence coverage for the selected repository's milestone claims. */
export function CoveragePanel({
  milestones,
}: {
  milestones: readonly Milestone[];
}) {
  const coverage = evidenceCoverage(milestones);
  const blocked = milestones.filter(
    (milestone) => milestone.review === "needs-evidence",
  ).length;

  return (
    <Panel
      title="Evidence coverage"
      description="How many milestone claims are fully backed by linked records."
    >
      <p className="text-2xl font-semibold tracking-tight tabular-nums">
        {coverage.percent}%
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {coverage.covered} of {coverage.total} claims fully linked
      </p>
      <div aria-hidden="true" className="mt-4 h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${coverage.percent}%` }}
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        A claim counts as covered when it has passed the needs-evidence gate and
        links at least {COVERAGE_MIN_EVIDENCE} independent records.
        {blocked > 0
          ? ` ${blocked} claim${blocked === 1 ? " is" : "s are"} currently blocked awaiting evidence.`
          : " No claims are currently blocked."}
      </p>
    </Panel>
  );
}
