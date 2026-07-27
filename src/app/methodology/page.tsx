import type { Metadata } from "next";

import {
  ConfidenceBadge,
  CONFIDENCE_META,
} from "@/components/confidence-badge";
import { EvidenceTypeBadge } from "@/components/evidence-type-badge";
import { ProductBadge } from "@/components/product-badge";
import {
  ReviewStateBadge,
  REVIEW_STATE_META,
} from "@/components/review-state-badge";
import { SectionHeading } from "@/components/section-heading";
import {
  CONFIDENCE_STATES,
  EVIDENCE_TYPES,
  REVIEW_STATES,
} from "@/lib/demo/types";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How CommitTrail turns repository history into claims you can stand behind: facts, evidence, deterministic metrics, drafts, and user approval.",
};

const VOCABULARY = [
  {
    term: "Fact",
    definition:
      "A record read directly from a repository: a commit, pull request, standalone issue, release, or workflow run. Phase 1B represents facts with stable identifiers but does not persist them.",
  },
  {
    term: "Evidence",
    definition:
      "A fact, file, or documentation section that has been linked to a claim as support. Evidence is a reference, not a copy — it can always be re-checked at the source.",
  },
  {
    term: "Derived metric",
    definition:
      "A number computed from facts by a reproducible rule — same input, same output, no model involved. Example: p95 latency figures read from benchmark runs.",
  },
  {
    term: "Claim",
    definition:
      "A human-readable statement about the work, such as a milestone. Every claim carries a confidence state, a review state, and its evidence links.",
  },
] as const;

const PIPELINE = [
  {
    name: "Facts are collected",
    body: "Repository metadata, commits, pull requests, issues, releases, and workflow runs are read through GitHub's APIs with read-only permission and normalized into stable records.",
    guarantee: "Nothing is written back to GitHub, ever.",
  },
  {
    name: "Evidence is pinned",
    body: "Records that support a potential story — plus selected files and documentation sections — become evidence entries with permanent references.",
    guarantee:
      "Evidence is referenced by stable identifiers, never paraphrased into place.",
  },
  {
    name: "Metrics are derived deterministically",
    body: "Phase 1B computes only transparent sampled arithmetic: workflow conclusion counts, published-release intervals, and issue/PR state counts.",
    guarantee: "Any derived number can be recomputed from its inputs.",
  },
  {
    name: "Drafts are AI-assisted, and say so",
    body: "An assistive model may propose milestone claims and case-study text — but only over collected evidence, and every draft is labeled as an AI-assisted draft.",
    guarantee:
      "Drafts cannot cite evidence that does not exist, and they never publish themselves.",
  },
  {
    name: "You approve, then it publishes",
    body: "The author reviews each claim against its evidence, edits or rejects it, and only explicitly approved claims reach a public page.",
    guarantee: "Publication is always a human decision.",
  },
] as const;

const CONFIDENCE_EXPLANATIONS: Record<
  (typeof CONFIDENCE_STATES)[number],
  string
> = {
  fact: "Stated directly by repository records. Example: “v1.0.0 was released on March 11, 2025.”",
  deterministic:
    "Computed by a reproducible rule over facts. Example: “7 of 10 completed workflow runs in the fetched window concluded successfully.”",
  "ai-draft":
    "Proposed by an assistive model from the evidence at hand. It stays visibly labeled until a person verifies it — and it can only be published after review.",
};

const REVIEW_EXPLANATIONS: Record<(typeof REVIEW_STATES)[number], string> = {
  draft:
    "The claim exists but nobody has reviewed it yet. Private by definition.",
  "needs-evidence":
    "The claim lacks sufficient linked records. It is blocked from verification and publication until evidence is attached.",
  verified:
    "The author checked the claim against its evidence and confirmed it is accurate.",
  published:
    "Verified and explicitly approved for a public page. The only state visible to anyone but the author.",
};

const EVIDENCE_EXPLANATIONS: Record<(typeof EVIDENCE_TYPES)[number], string> = {
  commit:
    "Points at a specific SHA and records its first message line and commit time.",
  "pull-request":
    "Records list-response state and dates; merged only when GitHub supplies a merged time. Reviews are not fetched.",
  issue:
    "Records a standalone issue title, state, labels, dates, and comment count. The body and comments are not fetched.",
  release:
    "Records a published tag/name and dates without fetching its body or assets.",
  "workflow-run":
    "Records a workflow run’s event, status, conclusion, branch/SHA, and dates. It is not automatically a test run.",
  file: "A file at a specific revision, such as a benchmark definition or fixture corpus.",
  "doc-section":
    "A section of documentation — an ADR, RFC, or changelog entry that explains intent.",
};

const BOUNDARIES = [
  "Rank, score, or compare developers",
  "Infer seniority or level from activity",
  "Treat commit counts as productivity",
  "Estimate burnout or working patterns",
  "Execute repository code",
  "Request GitHub write access",
  "Publish AI output automatically",
] as const;

export default function MethodologyPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="max-w-2xl">
        <ProductBadge />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Methodology
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          CommitTrail’s output is only worth something if every step from raw
          repository history to a published sentence is inspectable. This page
          defines the vocabulary, the pipeline, and the states a claim moves
          through — and the boundaries the product will not cross.
        </p>
      </div>

      <section aria-labelledby="vocabulary-heading" className="mt-16">
        <SectionHeading
          index="01"
          eyebrow="Vocabulary"
          id="vocabulary-heading"
          title="Four words, used precisely."
        />
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {VOCABULARY.map((entry) => (
            <div
              key={entry.term}
              className="rounded-xl border border-border bg-card p-5"
            >
              <dt className="font-mono text-sm font-medium text-primary">
                {entry.term}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {entry.definition}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="pipeline-heading" className="mt-16">
        <SectionHeading
          index="02"
          eyebrow="The pipeline"
          id="pipeline-heading"
          title="Facts → evidence → metrics → drafts → your approval."
          description="Each stage narrows what the next one is allowed to do."
        />
        <ol className="mt-8 space-y-4">
          {PIPELINE.map((stage, index) => (
            <li
              key={stage.name}
              className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[4rem_1fr] sm:gap-6"
            >
              <p className="font-mono text-sm text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div>
                <h3 className="font-semibold tracking-tight">{stage.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {stage.body}
                </p>
                <p className="mt-2.5 text-sm font-medium text-primary">
                  Guarantee: {stage.guarantee}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="confidence-heading" className="mt-16">
        <SectionHeading
          index="03"
          eyebrow="Confidence states"
          id="confidence-heading"
          title="Where a claim comes from is always visible."
        />
        <ul className="mt-8 space-y-4">
          {CONFIDENCE_STATES.map((state) => (
            <li
              key={state}
              className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:gap-6"
            >
              <div className="sm:w-48 sm:shrink-0">
                <ConfidenceBadge state={state} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {CONFIDENCE_META[state].description}{" "}
                {CONFIDENCE_EXPLANATIONS[state]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="review-heading" className="mt-16">
        <SectionHeading
          index="04"
          eyebrow="Review states"
          id="review-heading"
          title="Publication is a one-way gate you open."
          description="A claim can only move forward through review by explicit action of the author."
        />
        <ul className="mt-8 space-y-4">
          {REVIEW_STATES.map((state) => (
            <li
              key={state}
              className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:gap-6"
            >
              <div className="sm:w-48 sm:shrink-0">
                <ReviewStateBadge state={state} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {REVIEW_STATE_META[state].description}{" "}
                {REVIEW_EXPLANATIONS[state]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="evidence-types-heading" className="mt-16">
        <SectionHeading
          index="05"
          eyebrow="Evidence types"
          id="evidence-types-heading"
          title="Seven kinds of receipts."
        />
        <ul className="mt-8 space-y-3">
          {EVIDENCE_TYPES.map((type) => (
            <li
              key={type}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="sm:w-44 sm:shrink-0">
                <EvidenceTypeBadge type={type} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {EVIDENCE_EXPLANATIONS[type]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="boundaries-heading" className="mt-16">
        <SectionHeading
          index="06"
          eyebrow="Hard boundaries"
          id="boundaries-heading"
          title="What CommitTrail will never do."
          description="These are commitments, stated in the product and repeated in the documentation."
        />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {BOUNDARIES.map((boundary) => (
            <li
              key={boundary}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed"
            >
              <span
                aria-hidden="true"
                className="mt-1 font-mono text-xs text-muted-foreground select-none"
              >
                ✕
              </span>
              {boundary}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-16 max-w-2xl rounded-xl border border-border bg-surface p-6 text-sm leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">
          Phase 1B status:
        </strong>{" "}
        the first pipeline stage is live—read-only public repository snapshots
        plus bounded activity Fact records and transparent sampled arithmetic.
        Persistence, the evidence graph, drafting, review, and publishing remain
        later phases and are demonstrated with synthetic data—see the roadmap in
        the repository documentation.
      </p>
    </div>
  );
}
