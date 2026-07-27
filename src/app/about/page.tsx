import type { Metadata } from "next";

import { ProductBadge } from "@/components/product-badge";
import { SectionHeading } from "@/components/section-heading";
import { TrustPrinciplesList } from "@/components/trust-principles";
import { CheckIcon } from "@/components/icons";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "What CommitTrail is, what it refuses to be, and the principles it operates under.",
};

const IS_LIST = [
  "An evidence ledger for your engineering history",
  "A reviewed timeline of milestones you approved",
  "A generator of case studies, CV bullets, and project pages that cite their sources",
  "Read-only toward GitHub, always",
] as const;

const IS_NOT_LIST = [
  "A statistics dashboard or contribution-graph gallery",
  "A leaderboard, score, or seniority estimate",
  "An automatic bio writer that publishes without you",
  "A tool that runs or evaluates your code",
] as const;

export default function AboutPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="max-w-2xl">
        <ProductBadge />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          About {siteConfig.name}
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          {siteConfig.name} exists because the honest record of engineering work
          — commits, pull requests, releases, CI runs — is already public, yet
          nearly unreadable as a story. Recruiters skim it, engineers under-sell
          it, and AI-written summaries paper over it with claims nobody can
          check.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          {siteConfig.name} takes the opposite path: collect the facts first,
          derive only what can be recomputed, let a model draft only what stays
          pinned to evidence, and publish nothing until the author has verified
          it. The result is a portfolio where every technical claim has a paper
          trail.
        </p>
      </div>

      <div className="mt-14 grid gap-8 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
            What it is
          </h2>
          <ul className="mt-4 space-y-3">
            {IS_LIST.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            What it is not
          </h2>
          <ul className="mt-4 space-y-3">
            {IS_NOT_LIST.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                <span aria-hidden="true" className="mt-0.5 select-none">
                  —
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-16">
        <SectionHeading
          eyebrow="Trust principles"
          title="The rules the product is built around."
          description="Shared verbatim with the landing page and enforced in the documentation — these are requirements, not aspirations."
        />
        <TrustPrinciplesList className="mt-8" />
      </div>

      <div className="mt-16 max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-semibold tracking-tight">Current status</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Phase 1A — public repository snapshots. {siteConfig.name} can fetch a
          read-only snapshot of any public GitHub repository (metadata,
          languages, README), and the full future product remains previewed with
          synthetic data in the demo. There is still no account system, no
          persistence, and no deployment. Licensing will be decided before the
          public v1 release. {siteConfig.name} is an independent project, not
          affiliated with GitHub, Inc.
        </p>
      </div>
    </div>
  );
}
