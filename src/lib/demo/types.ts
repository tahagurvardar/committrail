/**
 * Types for the Phase 0 synthetic demo.
 *
 * These mirror the future evidence-first domain model (see
 * docs/decisions/0002-evidence-first-domain-model.md) but are populated from
 * hand-written deterministic fixtures only — no GitHub data is involved.
 */

export const EVIDENCE_TYPES = [
  "commit",
  "pull-request",
  "issue",
  "release",
  "workflow-run",
  "file",
  "doc-section",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const CONFIDENCE_STATES = ["fact", "deterministic", "ai-draft"] as const;

/**
 * How a claim was produced:
 * - "fact": read directly from repository records.
 * - "deterministic": computed by a reproducible rule over facts.
 * - "ai-draft": proposed by an assistive model, pending human judgment.
 */
export type ConfidenceState = (typeof CONFIDENCE_STATES)[number];

export const REVIEW_STATES = [
  "draft",
  "needs-evidence",
  "verified",
  "published",
] as const;

/**
 * Where a claim sits in the human review workflow:
 * - "draft": exists, not yet reviewed.
 * - "needs-evidence": blocked until evidence is linked.
 * - "verified": the author confirmed the claim against its evidence.
 * - "published": verified and explicitly approved for a public page.
 */
export type ReviewState = (typeof REVIEW_STATES)[number];

/** A single pointer from a claim to a concrete repository record. */
export interface EvidenceRef {
  type: EvidenceType;
  /** Short handle, e.g. "PR #196" or "run #588". */
  label: string;
  /** One-line description of what the record shows. */
  detail: string;
}

export interface Milestone {
  id: string;
  repoId: string;
  /** ISO date (UTC) the milestone is anchored to. */
  date: string;
  /** The reviewable technical claim. */
  claim: string;
  confidence: ConfidenceState;
  review: ReviewState;
  evidence: EvidenceRef[];
}

/** Counts of raw records ingested per evidence type. */
export interface EvidenceInventory {
  commits: number;
  pullRequests: number;
  issues: number;
  releases: number;
  workflowRuns: number;
  files: number;
  docSections: number;
}

/** Language share (in percent, summing to 100) for one period. */
export interface LanguageSlice {
  period: string;
  shares: Record<string, number>;
}

export interface DemoRelease {
  version: string;
  date: string;
  title: string;
}

export interface DemoPullRequest {
  number: number;
  title: string;
  mergedOn: string;
}

export interface WorkflowSummary {
  name: string;
  runsSampled: number;
  passed: number;
  lastRun: { id: number; date: string; passed: boolean };
}

export interface DemoCaseStudy {
  title: string;
  excerpt: string;
  citations: EvidenceRef[];
}

export interface DemoRepository {
  id: string;
  name: string;
  description: string;
  defaultBranch: string;
  activeFrom: string;
  activeTo: string;
  inventory: EvidenceInventory;
  languages: LanguageSlice[];
  releases: DemoRelease[];
  pullRequests: DemoPullRequest[];
  workflows: WorkflowSummary[];
  caseStudy: DemoCaseStudy;
}

export interface DemoDeveloper {
  name: string;
  handle: string;
  role: string;
  focus: string;
}
