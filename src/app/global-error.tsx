"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="p-8">
          <h1>CommitTrail is temporarily unavailable</h1>
          <p role="alert">
            The application stopped safely without exposing diagnostics.
          </p>
          <button type="button" onClick={reset}>
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
