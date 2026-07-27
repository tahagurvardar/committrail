import Link from "next/link";

import { AlertIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProviderErrorCode } from "@/lib/github/errors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SnapshotErrorDetails {
  code: Exclude<ProviderErrorCode, "not-found" | "invalid-input">;
  message: string;
  retryAfterSeconds: number | null;
  rateLimitResetAt: string | null;
}

const TITLES: Record<SnapshotErrorDetails["code"], string> = {
  "rate-limited": "GitHub rate-limited this site",
  "auth-config": "A server configuration issue interrupted this snapshot",
  "upstream-unavailable": "GitHub is unavailable right now",
  timeout: "GitHub didn’t respond in time",
  "malformed-response": "GitHub sent a response we couldn’t read",
  unexpected: "Something unexpected interrupted this snapshot",
};

/**
 * Honest, typed failure states for the snapshot route. No fabricated data,
 * no blame on the visitor, and rate-limit guidance with a concrete reset
 * time when GitHub provides one.
 */
export function SnapshotErrorState({
  owner,
  repo,
  error,
}: {
  owner: string;
  repo: string;
  error: SnapshotErrorDetails;
}) {
  return (
    <Card className="mx-auto max-w-xl p-6 sm:p-8">
      <AlertIcon className="size-5 text-amber-700 dark:text-amber-300" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-balance">
        {TITLES[error.code]}
      </h1>
      <p className="mt-1.5 font-mono text-sm text-muted-foreground">
        {owner}/{repo}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {error.message}
      </p>

      {error.code === "rate-limited" ? (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {error.rateLimitResetAt ? (
            <p>
              The limit resets at{" "}
              <time
                dateTime={error.rateLimitResetAt}
                className="font-mono text-foreground"
              >
                {formatDateTime(error.rateLimitResetAt)}
              </time>
              .
            </p>
          ) : null}
          {error.retryAfterSeconds !== null ? (
            <p>
              GitHub’s Retry-After guidance says to wait{" "}
              <span className="font-mono text-foreground">
                {formatRetryAfter(error.retryAfterSeconds)}
              </span>
              .
            </p>
          ) : null}
          {error.rateLimitResetAt === null &&
          error.retryAfterSeconds === null ? (
            <p>
              GitHub did not provide reliable retry timing. Please try again
              later.
            </p>
          ) : null}
          <p>
            Snapshot requests from this site share GitHub’s limits. Nothing is
            wrong with the repository, and no automatic retry was attempted.
          </p>
        </div>
      ) : null}

      {error.code === "auth-config" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          You don’t need an account or a token — this is on our side.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/repositories/${owner}/${repo}`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Try again
        </Link>
        <Link
          href="/explore"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          Back to explore
        </Link>
      </div>
    </Card>
  );
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
