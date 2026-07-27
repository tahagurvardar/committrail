import { SectionHeading } from "@/components/section-heading";
import { TrustPrinciplesList } from "@/components/trust-principles";

export function Principles() {
  return (
    <section aria-labelledby="principles-heading" className="bg-surface">
      <div className="container-page py-16 sm:py-24">
        <SectionHeading
          index="05"
          eyebrow="Trust principles"
          id="principles-heading"
          title="Constraints CommitTrail commits to."
          description="These are product boundaries, not marketing copy. They hold in every phase, and the documentation treats them as requirements."
        />
        <TrustPrinciplesList className="mt-10" />
      </div>
    </section>
  );
}
