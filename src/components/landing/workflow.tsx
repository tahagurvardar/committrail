import {
  CheckCircleIcon,
  DatabaseIcon,
  GlobeIcon,
  LinkIcon,
} from "@/components/icons";
import { SectionHeading } from "@/components/section-heading";

const STEPS = [
  {
    icon: LinkIcon,
    name: "Connect",
    body: "Grant read-only access and choose exactly which repositories CommitTrail may look at. Nothing else is touched.",
  },
  {
    icon: DatabaseIcon,
    name: "Collect",
    body: "Commits, pull requests, issues, releases, and workflow runs are normalized into an evidence store with stable references.",
  },
  {
    icon: CheckCircleIcon,
    name: "Verify",
    body: "Deterministic metrics and drafted claims are laid beside their evidence, and you confirm, edit, or reject each one.",
  },
  {
    icon: GlobeIcon,
    name: "Publish",
    body: "Only claims you explicitly approve become part of your public timeline, case studies, and project pages.",
  },
] as const;

export function Workflow() {
  return (
    <section aria-labelledby="workflow-heading">
      <div className="container-page py-16 sm:py-24">
        <SectionHeading
          index="02"
          eyebrow="How it works"
          id="workflow-heading"
          title="From raw history to reviewed claims."
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.name}
              className="relative rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <step.icon className="size-5 text-primary" />
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{step.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          Phase 1B note: CommitTrail can now read bounded public repository
          facts and recent activity evidence. Later pipeline stages remain a
          synthetic demo.
        </p>
      </div>
    </section>
  );
}
