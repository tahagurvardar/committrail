import {
  BookIcon,
  CheckIcon,
  CommitIcon,
  ExternalLinkIcon,
  FileIcon,
} from "@/components/icons";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";

const OUTPUTS = [
  {
    icon: CommitIcon,
    title: "Project timeline",
    body: "A dated sequence of verified milestones per repository — the story of the work in the order it happened.",
  },
  {
    icon: FileIcon,
    title: "Technical case study",
    body: "A long-form write-up of one project, with every technical claim linked to its evidence.",
  },
  {
    icon: CheckIcon,
    title: "CV bullets",
    body: "Tight, factual resume lines generated from verified claims — each one defensible in an interview.",
  },
  {
    icon: BookIcon,
    title: "Interview story",
    body: "A structured narrative — situation, decisions, outcome — grounded in the records of what actually shipped.",
  },
  {
    icon: ExternalLinkIcon,
    title: "Shareable project page",
    body: "A public page per project showing approved claims and their evidence trail, ready to send with an application.",
  },
] as const;

export function Outputs() {
  return (
    <section aria-labelledby="outputs-heading">
      <div className="container-page py-16 sm:py-24">
        <SectionHeading
          index="04"
          eyebrow="Outputs"
          id="outputs-heading"
          title="One verified timeline, many artifacts."
          description="Approve a claim once and reuse it everywhere the work needs to be shown."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUTS.map((output) => (
            <Card key={output.title} className="p-5 sm:p-6">
              <output.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold tracking-tight">
                {output.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {output.body}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
