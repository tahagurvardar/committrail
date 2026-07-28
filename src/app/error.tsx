"use client";

export default function ApplicationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="container-page py-20"
      aria-labelledby="application-error-title"
    >
      <p className="text-sm font-medium text-primary">Request interrupted</p>
      <h1 id="application-error-title" className="mt-2 text-3xl font-semibold">
        CommitTrail could not load this page
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground" role="alert">
        No private diagnostic details were exposed. Check local service
        readiness, then retry the request.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
      >
        Try again
      </button>
    </section>
  );
}
