import { MetricCard } from "@/components/metric-card";
import { evidenceCoverage, totalEvidenceLinks } from "@/lib/demo/derive";
import type { DemoDeveloper, Milestone } from "@/lib/demo/types";
import { formatCount } from "@/lib/format";

/**
 * Fictional developer identity plus portfolio-wide figures.
 * Metrics describe evidence volume and coverage — never productivity.
 */
export function ProfilePanel({
  developer,
  repositoryCount,
  milestones,
}: {
  developer: DemoDeveloper;
  repositoryCount: number;
  milestones: readonly Milestone[];
}) {
  const coverage = evidenceCoverage(milestones);
  const initials = developer.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary"
        >
          {initials}
        </span>
        <div>
          <p className="font-semibold tracking-tight">{developer.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            @{developer.handle}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{developer.role}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {developer.focus}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Repositories"
          value={formatCount(repositoryCount)}
          hint="Analyzed in this demo"
        />
        <MetricCard
          label="Milestones"
          value={formatCount(milestones.length)}
          hint="Drafted across all repos"
        />
        <MetricCard
          label="Evidence links"
          value={formatCount(totalEvidenceLinks(milestones))}
          hint="Records cited by claims"
        />
        <MetricCard
          label="Claim coverage"
          value={`${coverage.percent}%`}
          hint={`${coverage.covered} of ${coverage.total} claims fully linked`}
        />
      </div>
    </div>
  );
}
