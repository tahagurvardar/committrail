import Link from "next/link";

import { ArrowRightIcon, LogoMark } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/site";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-[0.95rem] font-semibold tracking-tight"
        >
          <LogoMark className="size-5 text-primary" />
          {siteConfig.name}
        </Link>

        <div className="flex items-center gap-2 sm:order-last">
          <ThemeToggle />
          <Link
            href="/explore"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            Explore a repository
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>

        <nav aria-label="Main" className="w-full sm:w-auto">
          <ul className="flex items-center gap-1">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
