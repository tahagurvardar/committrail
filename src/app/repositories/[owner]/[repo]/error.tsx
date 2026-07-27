"use client";

import { AlertIcon } from "@/components/icons";

/**
 * Last-resort boundary for failures the typed provider states don't cover.
 * Provider errors are rendered inline by the page; this catches the rest.
 */
export default function RepositorySnapshotError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center sm:py-32">
      <AlertIcon className="size-6 text-amber-700 dark:text-amber-300" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance">
        This snapshot hit an unexpected error.
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
        Nothing was fabricated in its place. You can retry, or come back later.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
