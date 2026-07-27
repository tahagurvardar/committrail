import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center py-28 text-center sm:py-36">
      <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
        404 — no evidence found
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        This trail doesn’t exist.
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
        The page you followed has no record here. It may have moved, or it may
        never have been written.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={cn(buttonVariants())}>
          Back to the start
          <ArrowRightIcon />
        </Link>
        <Link
          href="/demo"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Open the demo
        </Link>
      </div>
    </div>
  );
}
