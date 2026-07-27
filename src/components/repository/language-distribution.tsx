import { EmptyState } from "@/components/empty-state";
import { CommitIcon } from "@/components/icons";
import type { LanguageShare } from "@/lib/github/types";
import { cn } from "@/lib/utils";

const SEGMENT_CLASSES = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-stone-400",
] as const;

/**
 * Reported language byte distribution as a single stacked bar with an
 * accessible text alternative. Percentages are facts from GitHub's languages
 * endpoint — no quality interpretation is attached.
 */
export function LanguageDistribution({
  languages,
}: {
  languages: readonly LanguageShare[];
}) {
  if (languages.length === 0) {
    return (
      <EmptyState
        icon={CommitIcon}
        title="No language data reported"
        description="GitHub did not report language bytes for this repository. That can happen for very new, empty, or data-only repositories."
      />
    );
  }

  const readable = languages
    .map((language) => `${language.name} ${language.percent}%`)
    .join(", ");

  return (
    <div>
      <p className="sr-only">Share of reported language bytes: {readable}.</p>
      <div
        aria-hidden="true"
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
      >
        {languages.map((language, index) => (
          <span
            key={language.name}
            className={cn(
              "h-full",
              SEGMENT_CLASSES[index % SEGMENT_CLASSES.length],
            )}
            style={{ width: `${language.percent}%` }}
          />
        ))}
      </div>
      <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {languages.map((language, index) => (
          <li
            key={language.name}
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                SEGMENT_CLASSES[index % SEGMENT_CLASSES.length],
              )}
            />
            {language.name}
            <span className="font-mono text-xs tabular-nums">
              {language.percent}%
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Share of language bytes as reported by GitHub — a fact about file
        contents, not a statement about quality.
      </p>
    </div>
  );
}
