import type { ComponentType, SVGProps } from "react";

import {
  BookIcon,
  CommitIcon,
  FileIcon,
  IssueIcon,
  PullRequestIcon,
  ReleaseIcon,
  WorkflowIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { EvidenceType } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

interface EvidenceTypeMeta {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  className: string;
}

/**
 * One hue per evidence type, used consistently across badges, chips, and the
 * evidence graph. Icons + text labels carry the meaning; color is reinforcement,
 * never the only signal.
 */
export const EVIDENCE_TYPE_META: Record<EvidenceType, EvidenceTypeMeta> = {
  commit: {
    label: "Commit",
    icon: CommitIcon,
    className:
      "border-sky-600/30 bg-sky-500/10 text-sky-900 dark:border-sky-300/25 dark:text-sky-200",
  },
  "pull-request": {
    label: "Pull request",
    icon: PullRequestIcon,
    className:
      "border-indigo-600/30 bg-indigo-500/10 text-indigo-900 dark:border-indigo-300/25 dark:text-indigo-200",
  },
  issue: {
    label: "Issue",
    icon: IssueIcon,
    className:
      "border-amber-600/40 bg-amber-500/10 text-amber-900 dark:border-amber-300/25 dark:text-amber-200",
  },
  release: {
    label: "Release",
    icon: ReleaseIcon,
    className:
      "border-violet-600/30 bg-violet-500/10 text-violet-900 dark:border-violet-300/25 dark:text-violet-200",
  },
  "workflow-run": {
    label: "Workflow run",
    icon: WorkflowIcon,
    className:
      "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:border-emerald-300/25 dark:text-emerald-200",
  },
  file: {
    label: "File",
    icon: FileIcon,
    className:
      "border-stone-500/40 bg-stone-500/10 text-stone-700 dark:border-stone-400/30 dark:text-stone-300",
  },
  "doc-section": {
    label: "Doc section",
    icon: BookIcon,
    className:
      "border-rose-600/30 bg-rose-500/10 text-rose-900 dark:border-rose-300/25 dark:text-rose-200",
  },
};

export function EvidenceTypeBadge({
  type,
  className,
}: {
  type: EvidenceType;
  className?: string;
}) {
  const meta = EVIDENCE_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <Badge
      data-evidence-type={type}
      className={cn(meta.className, className)}
      variant="outline"
    >
      <Icon />
      {meta.label}
    </Badge>
  );
}
