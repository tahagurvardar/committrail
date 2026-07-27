import Link from "next/link";

import { IssueIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shown when GitHub answers 404 (or the address is invalid). GitHub does not
 * distinguish private from nonexistent repositories for anonymous access, so
 * neither do we — that ambiguity is stated honestly.
 */
export default function RepositoryNotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center sm:py-32">
      <IssueIcon className="size-6 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        Repository not found or not publicly accessible.
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
        GitHub reports nothing at this address through public-data access. The
        repository may be private, renamed, or it may never have existed —
        GitHub doesn’t say which, so neither do we.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/explore" className={cn(buttonVariants())}>
          Try another repository
        </Link>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to the start
        </Link>
      </div>
    </div>
  );
}
