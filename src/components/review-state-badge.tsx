import type { ComponentType, SVGProps } from "react";

import {
  AlertIcon,
  CheckCircleIcon,
  GlobeIcon,
  PencilIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { ReviewState } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

interface ReviewStateMeta {
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  className: string;
}

export const REVIEW_STATE_META: Record<ReviewState, ReviewStateMeta> = {
  draft: {
    label: "Draft",
    description: "Exists, but has not been reviewed yet.",
    icon: PencilIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  "needs-evidence": {
    label: "Needs evidence",
    description: "Blocked until concrete evidence is linked.",
    icon: AlertIcon,
    className:
      "border-amber-600/50 bg-amber-500/15 text-amber-900 dark:border-amber-300/40 dark:text-amber-200",
  },
  verified: {
    label: "User verified",
    description: "The author confirmed this claim against its evidence.",
    icon: CheckCircleIcon,
    className: "border-transparent bg-primary text-primary-foreground",
  },
  published: {
    label: "Published",
    description: "Verified and explicitly approved for a public page.",
    icon: GlobeIcon,
    className:
      "border-emerald-600/40 bg-emerald-500/10 text-emerald-900 dark:border-emerald-300/30 dark:text-emerald-200",
  },
};

export function ReviewStateBadge({
  state,
  className,
}: {
  state: ReviewState;
  className?: string;
}) {
  const meta = REVIEW_STATE_META[state];
  const Icon = meta.icon;
  return (
    <Badge
      data-review-state={state}
      title={meta.description}
      className={cn(meta.className, className)}
    >
      <Icon />
      {meta.label}
    </Badge>
  );
}
