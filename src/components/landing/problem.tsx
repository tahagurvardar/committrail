import { CommitIcon, LayersIcon, SparkleIcon } from "@/components/icons";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";

const PROBLEMS = [
  {
    icon: LayersIcon,
    title: "Profiles bury the work",
    body: "A raw GitHub profile is a wall of repositories and activity tiles. The judgment calls, migrations, and hard-won fixes that define an engineer are invisible in it.",
  },
  {
    icon: CommitIcon,
    title: "Counts are not competence",
    body: "Commit totals and streaks measure typing cadence, not engineering. Reading them as productivity rewards noise and punishes deep work.",
  },
  {
    icon: SparkleIcon,
    title: "Summaries without receipts",
    body: "AI-written portfolio blurbs read well but cite nothing. A reviewer has no way to tell grounded insight from confident invention.",
  },
] as const;

export function Problem() {
  return (
    <section aria-labelledby="problem-heading" className="bg-surface">
      <div className="container-page py-16 sm:py-24">
        <SectionHeading
          index="01"
          eyebrow="The problem"
          id="problem-heading"
          title="GitHub history is evidence-rich but story-poor."
          description="The record of real engineering work already exists — it is just unreadable in the form GitHub presents it."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((problem) => (
            <Card key={problem.title} className="p-5 sm:p-6">
              <problem.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold tracking-tight">
                {problem.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {problem.body}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
