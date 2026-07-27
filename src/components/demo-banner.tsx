import { AlertIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Prominent notice that everything on the demo surface is fictional. */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="Synthetic demo notice"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-600/40 bg-amber-500/10 p-4 text-sm dark:border-amber-300/30",
        className,
      )}
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
      <p className="leading-relaxed text-amber-950 dark:text-amber-100">
        <strong className="font-semibold">Synthetic demo.</strong> Every
        developer, repository, and metric on this page is fictional and
        generated deterministically from code checked into this repository. No
        GitHub account is connected in Phase 0.
      </p>
    </div>
  );
}
