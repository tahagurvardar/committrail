"use client";

import type { DemoRepository } from "@/lib/demo/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Radio-group repository picker. Native radios (visually hidden) keep full
 * keyboard and screen-reader semantics without custom listbox code.
 */
export function RepositorySelector({
  repositories,
  selectedId,
  onSelect,
  className,
}: {
  repositories: readonly DemoRepository[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="sr-only">Select a repository</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {repositories.map((repo) => {
          const selected = repo.id === selectedId;
          return (
            <label
              key={repo.id}
              data-selected={selected || undefined}
              className={cn(
                "cursor-pointer rounded-lg border border-border bg-card p-3.5 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:bg-accent",
                selected && "border-primary bg-primary/5 hover:bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="demo-repository"
                value={repo.id}
                checked={selected}
                onChange={() => onSelect(repo.id)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-mono text-sm font-medium">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full border border-muted-foreground",
                    selected && "border-primary bg-primary",
                  )}
                />
                {repo.name}
              </span>
              <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                {repo.description}
              </span>
              <span className="mt-2 block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                {formatDate(repo.activeFrom)} – {formatDate(repo.activeTo)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
