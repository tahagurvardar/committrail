import type { Metadata } from "next";

import { DemoBanner } from "@/components/demo-banner";
import { DemoDashboard } from "@/components/demo/demo-dashboard";
import { ProductBadge } from "@/components/product-badge";

export const metadata: Metadata = {
  title: "Product demo",
  description:
    "A deterministic, fully synthetic walkthrough of CommitTrail: evidence-backed milestones, review states, and derived signals for a fictional developer.",
};

export default function DemoPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="max-w-2xl">
        <ProductBadge />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Portfolio intelligence, demonstrated.
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          This is the product working end to end on synthetic fixtures: a
          fictional developer, three fictional repositories, and milestones in
          every confidence and review state the real pipeline will produce.
        </p>
      </div>
      <DemoBanner className="mt-8" />
      <div className="mt-12">
        <DemoDashboard />
      </div>
    </div>
  );
}
