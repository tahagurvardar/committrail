import { ConfidenceBadge } from "@/components/confidence-badge";
import { ExternalLinkIcon } from "@/components/icons";
import { ReviewStateBadge } from "@/components/review-state-badge";
import { Card } from "@/components/ui/card";
import type { DemoCaseStudy } from "@/lib/demo/types";

/** Preview of an AI-assisted case-study draft, clearly labeled and gated. */
export function CaseStudyPanel({ caseStudy }: { caseStudy: DemoCaseStudy }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Draft case study
        </p>
        <div className="flex flex-wrap gap-2">
          <ConfidenceBadge state="ai-draft" />
          <ReviewStateBadge state="draft" />
        </div>
      </div>

      <h3 className="mt-4 text-lg font-semibold tracking-tight text-balance">
        {caseStudy.title}
      </h3>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {caseStudy.excerpt}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {caseStudy.citations.map((citation) => (
          <button
            key={citation.label}
            type="button"
            aria-disabled="true"
            title={`${citation.detail} — source links are disabled in the synthetic demo`}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-muted-foreground opacity-80"
          >
            <ExternalLinkIcon className="size-3" />
            {citation.label}
            <span className="sr-only">(source link disabled in the demo)</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          type="button"
          aria-disabled="true"
          title="Review controls activate when the real review workflow ships"
          className="inline-flex h-9 cursor-not-allowed items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground opacity-60"
        >
          Approve draft
          <span className="sr-only">(disabled in the demo)</span>
        </button>
        <button
          type="button"
          aria-disabled="true"
          title="Review controls activate when the real review workflow ships"
          className="inline-flex h-9 cursor-not-allowed items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-muted-foreground opacity-70"
        >
          Request changes
          <span className="sr-only">(disabled in the demo)</span>
        </button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Drafts never publish automatically — approval stays with the author.
        </p>
      </div>
    </Card>
  );
}
