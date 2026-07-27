import Link from "next/link";

import { ExternalLinkIcon, LogoMark } from "@/components/icons";
import { ProductBadge } from "@/components/product-badge";
import { siteConfig } from "@/lib/site";

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
            Phase 1A — live read-only snapshots of public repositories, plus the
            synthetic full-product demo. No accounts, no data persistence, no
            deployment yet.
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
            Licensing will be decided before the public v1 release.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-1 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            CommitTrail is an independent project and is not affiliated with,
            endorsed by, or sponsored by GitHub, Inc.
          </p>
          <p className="font-mono">Phase 1A snapshot</p>
        </div>
      </div>
    </footer>
  );
}
