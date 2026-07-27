import { cn } from "@/lib/utils";

/**
 * Small labeled figure. Metrics in CommitTrail describe evidence volume and
 * coverage — never developer productivity.
 */
export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
