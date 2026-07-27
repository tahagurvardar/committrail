import { TimelineMilestone } from "@/components/timeline-milestone";
import type { Milestone } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

/**
 * Vertical engineering timeline, newest milestone first, hung on a hairline
 * rail that echoes the commit-trail motif.
 */
export function Timeline({
  milestones,
  className,
}: {
  milestones: readonly Milestone[];
  className?: string;
}) {
  const sorted = [...milestones].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ol
      className={cn(
        "relative space-y-5 before:absolute before:top-6 before:bottom-6 before:left-1.5 before:w-px before:bg-rail",
        className,
      )}
    >
      {sorted.map((milestone) => (
        <TimelineMilestone key={milestone.id} milestone={milestone} />
      ))}
    </ol>
  );
}
