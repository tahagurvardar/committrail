import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Small phase indicator shown in the hero and footer. */
export function ProductBadge({
  label = siteConfig.phaseLabel,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
      {label}
    </span>
  );
}
