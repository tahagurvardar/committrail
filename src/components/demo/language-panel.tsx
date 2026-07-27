import { Panel } from "@/components/demo/panel";
import type { LanguageSlice } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const SEGMENT_CLASSES = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-stone-400",
] as const;

/** Stable language → color assignment by first appearance across periods. */
function languageOrder(slices: readonly LanguageSlice[]): string[] {
  const order: string[] = [];
  for (const slice of slices) {
    for (const language of Object.keys(slice.shares)) {
      if (!order.includes(language)) {
        order.push(language);
      }
    }
  }
  return order;
}

export function LanguagePanel({
  languages,
}: {
  languages: readonly LanguageSlice[];
}) {
  const order = languageOrder(languages);
  const colorFor = (language: string) =>
    SEGMENT_CLASSES[order.indexOf(language) % SEGMENT_CLASSES.length];
  const latest = languages[languages.length - 1];

  return (
    <Panel
      title="Language evolution"
      description="Share of code by language per quarter, derived deterministically from commit facts."
    >
      <ul className="space-y-3">
        {languages.map((slice) => {
          const readable = order
            .filter((language) => slice.shares[language] !== undefined)
            .map((language) => `${language} ${slice.shares[language]}%`)
            .join(", ");
          return (
            <li
              key={slice.period}
              className="grid grid-cols-[4.5rem_1fr] items-center gap-3"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {slice.period}
              </span>
              <span className="sr-only">{readable}</span>
              <span
                aria-hidden="true"
                className="flex h-2.5 overflow-hidden rounded-full bg-muted"
              >
                {order.map((language) => {
                  const share = slice.shares[language];
                  if (share === undefined) {
                    return null;
                  }
                  return (
                    <span
                      key={language}
                      className={cn("h-full", colorFor(language))}
                      style={{ width: `${share}%` }}
                    />
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {order.map((language) => (
          <li
            key={language}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", colorFor(language))}
            />
            {language}
            {latest && latest.shares[language] !== undefined ? (
              <span className="font-mono tabular-nums">
                {latest.shares[language]}%
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
