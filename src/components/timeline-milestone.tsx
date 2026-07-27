import { ConfidenceBadge } from "@/components/confidence-badge";
import { EvidenceTypeBadge } from "@/components/evidence-type-badge";
import { AlertIcon, ExternalLinkIcon } from "@/components/icons";
import { ReviewStateBadge } from "@/components/review-state-badge";
import { Card } from "@/components/ui/card";
import { evidenceTypesOf } from "@/lib/demo/derive";
import type { Milestone } from "@/lib/demo/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The core object of the product: one reviewable claim with its date,
 * confidence origin, review state, and linked evidence.
 * Used inside the demo Timeline and as the specimen card in the hero.
 */
export function MilestoneCard({
  milestone,
  className,
}: {
  milestone: Milestone;
  className?: string;
}) {
  const evidenceTypes = evidenceTypesOf(milestone);
  const evidenceCount = milestone.evidence.length;

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <article aria-label={milestone.claim}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <time
            dateTime={milestone.date}
            className="font-mono text-xs text-muted-foreground"
          >
            {formatDate(milestone.date)}
          </time>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {evidenceCount === 1
              ? "1 evidence link"
              : `${evidenceCount} evidence links`}
          </p>
        </div>

        <p className="mt-2.5 leading-snug font-medium text-pretty">
          {milestone.claim}
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <ConfidenceBadge state={milestone.confidence} />
          <ReviewStateBadge state={milestone.review} />
        </div>

        {evidenceTypes.length > 0 ? (
          <ul
            aria-label="Evidence types"
            className="mt-3 flex flex-wrap gap-1.5"
          >
            {evidenceTypes.map((type) => (
              <li key={type}>
                <EvidenceTypeBadge type={type} />
              </li>
            ))}
          </ul>
        ) : null}

        {evidenceCount > 0 ? (
          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-border pt-3.5">
            {milestone.evidence.map((ref) => (
              <button
                key={`${ref.type}-${ref.label}`}
                type="button"
                aria-disabled="true"
                title={`${ref.detail} — source links are disabled in the synthetic demo`}
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-muted-foreground opacity-80"
              >
                <ExternalLinkIcon className="size-3" />
                {ref.label}
                <span className="sr-only">
                  (source link disabled in the demo)
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3.5 flex items-start gap-2 border-t border-border pt-3.5 text-xs leading-relaxed text-muted-foreground">
            <AlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
            No evidence linked yet — this claim cannot be verified or published
            until records are attached.
          </p>
        )}
      </article>
    </Card>
  );
}

/** One milestone hung on the timeline rail. */
export function TimelineMilestone({ milestone }: { milestone: Milestone }) {
  return (
    <li className="relative pl-9">
      <span
        aria-hidden="true"
        className="absolute top-5 left-0 flex size-[13px] items-center justify-center rounded-full border-2 border-primary bg-background"
      />
      <MilestoneCard milestone={milestone} />
    </li>
  );
}
