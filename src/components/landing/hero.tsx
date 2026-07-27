import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";
import { ProductBadge } from "@/components/product-badge";
import { MilestoneCard } from "@/components/timeline-milestone";
import { buttonVariants } from "@/components/ui/button";
import { demoMilestones } from "@/lib/demo/data";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const specimen = demoMilestones.find((m) => m.id === "pulseboard-wasm");

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="trail-dots absolute inset-0 opacity-60 dark:opacity-35"
      />
      <div className="container-page relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="max-w-xl">
          <ProductBadge className="motion-safe:animate-rise" />
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance motion-safe:animate-rise motion-safe:[animation-delay:80ms] sm:text-5xl lg:text-[3.4rem] lg:leading-[1.06]">
            Turn GitHub history into evidence-backed engineering stories.
          </h1>
          <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:160ms]">
            {siteConfig.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 motion-safe:animate-rise motion-safe:[animation-delay:240ms]">
            <Link href="/demo" className={cn(buttonVariants({ size: "lg" }))}>
              Explore the demo
              <ArrowRightIcon />
            </Link>
            <Link
              href="/methodology"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Read the methodology
            </Link>
          </div>
          <p className="mt-6 font-mono text-xs tracking-wide text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:300ms]">
            Read-only by design · Nothing publishes without your approval
          </p>
        </div>

        {specimen ? (
          <div className="motion-safe:animate-rise motion-safe:[animation-delay:200ms]">
            <MilestoneCard
              milestone={specimen}
              className="shadow-[0_18px_50px_-24px_rgb(0_0_0/0.25)]"
            />
            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
              A milestone as CommitTrail records it — claim, confidence, review
              state, evidence.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
