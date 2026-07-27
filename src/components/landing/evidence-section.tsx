import { EvidenceGraphPreview } from "@/components/evidence-graph-preview";
import { EvidenceTypeBadge } from "@/components/evidence-type-badge";
import { SectionHeading } from "@/components/section-heading";
import { EVIDENCE_TYPES } from "@/lib/demo/types";

export function EvidenceSection() {
  return (
    <section aria-labelledby="evidence-heading" className="bg-surface">
      <div className="container-page py-16 sm:py-24">
        <SectionHeading
          index="03"
          eyebrow="Evidence graph"
          id="evidence-heading"
          title="Every claim keeps its receipts."
          description="Claims are nodes in an evidence graph, permanently linked to the repository records that support them. If a claim cannot point at evidence, it does not publish."
        />
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <EvidenceGraphPreview />
          <div>
            <h3 className="font-semibold tracking-tight">
              Seven kinds of evidence
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              CommitTrail links claims to the records GitHub already keeps —
              plus the files and documentation sections that explain them.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {EVIDENCE_TYPES.map((type) => (
                <li key={type}>
                  <EvidenceTypeBadge type={type} />
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Each reference is pinned to a stable identifier — a SHA, a pull
              request number, a release tag, a workflow run id — so a claim can
              be re-checked long after it was written.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
