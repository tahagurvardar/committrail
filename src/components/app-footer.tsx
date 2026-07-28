import Link from "next/link";

import { ExternalLinkIcon, LogoMark } from "@/components/icons";
import { ProductBadge } from "@/components/product-badge";
import { siteConfig } from "@/lib/site";
import { APP_VERSION } from "@/lib/version";

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark className="size-5 text-primary" />
            {siteConfig.name}
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {siteConfig.tagline}
          </p>
          <ProductBadge />
        </div>

        <nav aria-label="Footer" className="text-sm">
          <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Explore
          </p>
          <ul className="mt-3 space-y-2">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm">
          <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Status
          </p>
          <p className="mt-3 max-w-xs leading-relaxed text-muted-foreground">
            Portfolio-quality v1 with read-only GitHub ingestion, evidence
            provenance, reviewed claims, deliberate publishing, and
            deterministic private outputs. No production deployment is claimed.
          </p>
          <a
            href={siteConfig.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3.5" />
            Source repository
          </a>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
            MIT licensed. Optional integrations remain server-owned and disabled
            by default.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-1 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            CommitTrail is an independent project and is not affiliated with,
            endorsed by, or sponsored by GitHub, Inc.
          </p>
          <p className="font-mono">v{APP_VERSION}</p>
        </div>
      </div>
    </footer>
  );
}
