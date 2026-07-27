/** Skeleton for the repository snapshot while GitHub is queried. */
export default function LoadingRepositorySnapshot() {
  return (
    <div className="container-page py-10 sm:py-14">
      <p role="status" className="sr-only">
        Loading repository snapshot from GitHub…
      </p>
      <div aria-hidden="true" className="space-y-8">
        <div className="flex items-start gap-4">
          <div className="size-14 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-2/5 min-w-48 rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-3/5 rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-lg border border-border bg-muted/60 motion-safe:animate-pulse"
            />
          ))}
        </div>
        <div className="h-40 rounded-xl border border-border bg-muted/40 motion-safe:animate-pulse" />
        <div className="h-56 rounded-xl border border-border bg-muted/40 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
