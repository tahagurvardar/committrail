import type { ComponentType, SVGProps } from "react";

import { DatabaseIcon, DeriveIcon, SparkleIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { ConfidenceState } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

interface ConfidenceMeta {
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  className: string;
}

/**
 * Three visually distinct treatments — solid ink, tinted outline, dashed
 * amber — so the origin of a claim is legible even without reading color.
 */
export const CONFIDENCE_META: Record<ConfidenceState, ConfidenceMeta> = {
  fact: {
    label: "Fact",
    description: "Read directly from repository records.",
    icon: DatabaseIcon,
    className: "border-transparent bg-foreground text-background",
  },
  deterministic: {
    label: "Deterministic",
    description: "Computed by a reproducible rule over facts.",
    icon: DeriveIcon,
    className: "border-primary/50 bg-primary/10 text-primary",
  },
  "ai-draft": {
    label: "AI-assisted draft",
    description: "Proposed by an assistive model; awaiting human judgment.",
    icon: SparkleIcon,
    className:
      "border-dashed border-amber-600/60 bg-amber-500/10 text-amber-900 dark:border-amber-300/50 dark:text-amber-200",
  },
};

export function ConfidenceBadge({
  state,
  className,
}: {
  state: ConfidenceState;
  className?: string;
}) {
  const meta = CONFIDENCE_META[state];
  const Icon = meta.icon;
  return (
    <Badge
      data-confidence={state}
      title={meta.description}
      className={cn(meta.className, className)}
    >
      <Icon />
      {meta.label}
    </Badge>
  );
}
