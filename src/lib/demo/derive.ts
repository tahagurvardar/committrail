import type {
  EvidenceInventory,
  EvidenceType,
  Milestone,
} from "@/lib/demo/types";

/**
 * Deterministic derivations over demo fixtures.
 *
 * In later phases these rules run over real ingested facts; the important
 * property — same input, same output, no model involved — is established here.
 */

export function milestonesForRepo(
  milestones: readonly Milestone[],
  repoId: string,
): Milestone[] {
  return milestones.filter((milestone) => milestone.repoId === repoId);
}

/** Minimum number of linked records for a claim to count as covered. */
export const COVERAGE_MIN_EVIDENCE = 2;

export interface EvidenceCoverage {
  covered: number;
  total: number;
  /** Whole percentage, 0–100. Defined as 0 for an empty milestone list. */
  percent: number;
}

/**
 * A milestone is covered when it is past the "needs-evidence" gate and links
 * at least COVERAGE_MIN_EVIDENCE independent records.
 */
export function evidenceCoverage(
  milestones: readonly Milestone[],
): EvidenceCoverage {
  const total = milestones.length;
  const covered = milestones.filter(
    (milestone) =>
      milestone.review !== "needs-evidence" &&
      milestone.evidence.length >= COVERAGE_MIN_EVIDENCE,
  ).length;
  const percent = total === 0 ? 0 : Math.round((covered / total) * 100);
  return { covered, total, percent };
}

export function totalEvidenceLinks(milestones: readonly Milestone[]): number {
  return milestones.reduce(
    (sum, milestone) => sum + milestone.evidence.length,
    0,
  );
}

/** Distinct evidence types linked by a milestone, in canonical order. */
export function evidenceTypesOf(milestone: Milestone): EvidenceType[] {
  return [...new Set(milestone.evidence.map((ref) => ref.type))];
}

export function inventoryTotal(inventory: EvidenceInventory): number {
  return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}
