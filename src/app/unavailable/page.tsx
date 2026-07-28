import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unavailable in public demo",
  robots: { index: false, follow: false },
};

export default function UnavailablePage() {
  return (
    <section className="container-page py-20">
      <p className="text-sm font-medium text-primary">Public demo</p>
      <h1 className="mt-2 text-3xl font-semibold">
        Account features are disabled
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        This database-free demo stores no account or private repository data.
        Explore the synthetic walkthrough or public, read-only repository
        surfaces instead.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          href="/demo"
        >
          View synthetic demo
        </Link>
        <Link className="rounded-md border px-4 py-2" href="/explore">
          Explore public data
        </Link>
      </div>
    </section>
  );
}
