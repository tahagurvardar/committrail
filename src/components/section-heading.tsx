import { cn } from "@/lib/utils";

/**
 * Ledger-style section heading: mono index + eyebrow, then title and lede.
 * The optional id lets sections reference it via aria-labelledby.
 */
export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  id,
  align = "left",
  className,
}: {
  index?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  id?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
          {index ? (
            <span className="text-muted-foreground">{index} / </span>
          ) : null}
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
