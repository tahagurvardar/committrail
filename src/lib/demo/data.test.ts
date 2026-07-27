import { describe, expect, it } from "vitest";

import { demoMilestones, demoRepositories } from "@/lib/demo/data";
import { evidenceCoverage, totalEvidenceLinks } from "@/lib/demo/derive";
import {
  CONFIDENCE_STATES,
  EVIDENCE_TYPES,
  REVIEW_STATES,
} from "@/lib/demo/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("demo fixtures", () => {
  it("anchor every milestone to an existing repository", () => {
    const repoIds = new Set(demoRepositories.map((repo) => repo.id));
    for (const milestone of demoMilestones) {
      expect(repoIds).toContain(milestone.repoId);
    }
  });

  it("use valid ISO dates inside each repository's active range", () => {
    for (const milestone of demoMilestones) {
      expect(milestone.date).toMatch(ISO_DATE);
      const repo = demoRepositories.find((r) => r.id === milestone.repoId);
      expect(repo).toBeDefined();
      if (repo) {
        expect(milestone.date >= repo.activeFrom).toBe(true);
        expect(milestone.date <= repo.activeTo).toBe(true);
      }
    }
  });

  it("store milestones oldest-first within each repository", () => {
    for (const repo of demoRepositories) {
      const dates = demoMilestones
        .filter((milestone) => milestone.repoId === repo.id)
        .map((milestone) => milestone.date);
      expect(dates).toEqual([...dates].sort());
    }
  });

  it("cover every confidence state, review state, and evidence type", () => {
    const confidences = new Set(demoMilestones.map((m) => m.confidence));
    const reviews = new Set(demoMilestones.map((m) => m.review));
    const evidenceTypes = new Set(
      demoMilestones.flatMap((m) => m.evidence.map((ref) => ref.type)),
    );

    for (const state of CONFIDENCE_STATES) {
      expect(confidences).toContain(state);
    }
    for (const state of REVIEW_STATES) {
      expect(reviews).toContain(state);
    }
    for (const type of EVIDENCE_TYPES) {
      expect(evidenceTypes).toContain(type);
    }
  });

  it("only leave claims without evidence in the needs-evidence state", () => {
    for (const milestone of demoMilestones) {
      if (milestone.review === "needs-evidence") {
        expect(milestone.evidence).toHaveLength(0);
      } else {
        expect(milestone.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it("keep language shares summing to exactly 100 per period", () => {
    for (const repo of demoRepositories) {
      for (const slice of repo.languages) {
        const sum = Object.values(slice.shares).reduce((a, b) => a + b, 0);
        expect(sum, `${repo.id} ${slice.period}`).toBe(100);
      }
    }
  });

  it("produce the exact portfolio figures the demo displays", () => {
    expect(demoMilestones).toHaveLength(10);
    expect(totalEvidenceLinks(demoMilestones)).toBe(30);
    expect(evidenceCoverage(demoMilestones)).toEqual({
      covered: 8,
      total: 10,
      percent: 80,
    });
  });

  it("keep workflow pass counts within the sampled run count", () => {
    for (const repo of demoRepositories) {
      for (const workflow of repo.workflows) {
        expect(workflow.passed).toBeGreaterThanOrEqual(0);
        expect(workflow.passed).toBeLessThanOrEqual(workflow.runsSampled);
      }
    }
  });
});
