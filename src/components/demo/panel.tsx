import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared shell for demo dashboard panels: title, optional lede, content. */
export function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col p-5", className)}>
      <h3 className="font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4 flex-1">{children}</div>
    </Card>
  );
}
