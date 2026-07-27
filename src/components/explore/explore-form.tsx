"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowRightIcon } from "@/components/icons";
import { parseRepositoryInput } from "@/lib/github/parse-repository-input";
import { cn } from "@/lib/utils";

/**
 * Progressive-enhancement repository form.
 *
 * Without JavaScript it submits as a plain GET to /explore, where the server
 * parses the input and redirects or re-renders with an error. With
 * JavaScript, the same parser runs locally for instant validation and the
 * router navigates straight to the snapshot route. No GitHub request ever
 * originates in the browser.
 */
export function ExploreForm({
  defaultValue = "",
  serverError,
}: {
  defaultValue?: string;
  serverError?: string;
}) {
  const router = useRouter();
  const [clientError, setClientError] = useState<string | null>(null);
  const [showServerError, setShowServerError] = useState(true);
  const [pending, setPending] = useState(false);
  const error = clientError ?? (showServerError ? (serverError ?? null) : null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const raw = String(data.get("repository") ?? "");
    const result = parseRepositoryInput(raw);
    event.preventDefault();
    if (!result.ok) {
      setShowServerError(false);
      setClientError(result.error.message);
      return;
    }
    setShowServerError(false);
    setClientError(null);
    setPending(true);
    router.push(`/repositories/${result.value.owner}/${result.value.repo}`);
  }

  return (
    <form
      method="get"
      action="/explore"
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-xl"
    >
      <label htmlFor="repository-input" className="block text-sm font-medium">
        Public GitHub repository
      </label>
      <p id="repository-hint" className="mt-1 text-xs text-muted-foreground">
        owner/repository or a full github.com URL
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="repository-input"
          name="repository"
          type="text"
          defaultValue={defaultValue}
          autoComplete="off"
          spellCheck={false}
          maxLength={250}
          aria-describedby={
            error ? "repository-error repository-hint" : "repository-hint"
          }
          aria-invalid={error ? true : undefined}
          onChange={() => {
            setShowServerError(false);
            setClientError(null);
          }}
          className={cn(
            "h-11 w-full rounded-md border border-input bg-card px-3 font-mono text-sm placeholder:text-muted-foreground/70",
            error && "border-amber-600/70 dark:border-amber-300/60",
          )}
          placeholder="vercel/next.js"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "Fetching snapshot…" : "Fetch snapshot"}
          <ArrowRightIcon className="size-4" />
        </button>
      </div>
      <div aria-live="polite">
        {error ? (
          <p
            id="repository-error"
            className="mt-2 text-sm text-amber-900 dark:text-amber-200"
          >
            {error}
          </p>
        ) : null}
        {pending ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            Contacting GitHub for a read-only snapshot…
          </p>
        ) : null}
      </div>
    </form>
  );
}
