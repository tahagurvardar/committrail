import { describe, expect, it } from "vitest";
import { validateGroundedDraftOutput } from "@/lib/drafting/output-validation";
import type { GroundedEvidenceBundle } from "@/lib/drafting/types";

const bundle: GroundedEvidenceBundle = {
  schemaVersion: 1,
  orderedEvidenceIds: ["evidence-1", "evidence-2"],
  contentHashes: ["a".repeat(64), "b".repeat(64)],
  evidence: [
    {
      id: "evidence-1",
      type: "pull-request",
      occurredAt: "2026-07-01T00:00:00.000Z",
      title: "Merge queue change",
      sourceUrl: "https://github.com/example/project/pull/42",
      confidence: "fact",
      contentHash: "a".repeat(64),
      facts: { number: 42, state: "closed" },
    },
    {
      id: "evidence-2",
      type: "workflow-run",
      occurredAt: "2026-07-02T00:00:00.000Z",
      title: "CI run",
      sourceUrl: "https://github.com/example/project/actions/runs/7",
      confidence: "fact",
      contentHash: "b".repeat(64),
      facts: { runNumber: 7, conclusion: "success" },
    },
  ],
};

const valid = {
  title: "Grounded change",
  sentences: [
    {
      text: "Pull request 42 introduced the recorded change.",
      evidenceIds: ["evidence-1"],
    },
    {
      text: "Workflow run 7 concluded successfully.",
      evidenceIds: ["evidence-2"],
    },
  ],
  caveats: ["The selected evidence is a bounded recent sample."],
};

describe("grounded draft output validation", () => {
  it("accepts strict sentence citations and reports mechanical coverage", () => {
    const result = validateGroundedDraftOutput(
      JSON.stringify(valid),
      bundle,
      16 * 1024,
    );
    expect(result.coverage).toEqual({
      sentenceCount: 2,
      citedSentenceCount: 2,
      uniqueEvidenceCount: 2,
      selectedEvidenceCount: 2,
      evidenceTypesUsed: ["pull-request", "workflow-run"],
      unusedSelectedEvidenceCount: 0,
    });
  });

  it.each([
    ["malformed", "not json"],
    ["code fence", "```json\n{}\n```"],
    [
      "unknown citation",
      JSON.stringify({
        ...valid,
        sentences: [{ text: "Grounded.", evidenceIds: ["unknown"] }],
      }),
    ],
    [
      "missing citation",
      JSON.stringify({
        ...valid,
        sentences: [{ text: "Grounded.", evidenceIds: [] }],
      }),
    ],
    [
      "extra field",
      JSON.stringify({ ...valid, chainOfThought: "hidden reasoning" }),
    ],
    [
      "HTML",
      JSON.stringify({
        ...valid,
        sentences: [
          { text: "<strong>Grounded</strong>", evidenceIds: ["evidence-1"] },
        ],
      }),
    ],
    [
      "Markdown URL",
      JSON.stringify({
        ...valid,
        sentences: [
          {
            text: "[Grounded](https://example.test)",
            evidenceIds: ["evidence-1"],
          },
        ],
      }),
    ],
    [
      "Markdown emphasis",
      JSON.stringify({
        ...valid,
        sentences: [
          {
            text: "**Grounded** change.",
            evidenceIds: ["evidence-1"],
          },
        ],
      }),
    ],
  ])("rejects %s output", (_label, raw) => {
    expect(() => validateGroundedDraftOutput(raw, bundle, 16 * 1024)).toThrow();
  });

  it.each([
    "This proves they are the top developer.",
    "The developer has senior engineer ability.",
    "This shows exceptional productivity.",
    "The code is production ready.",
    "The system is fully secure.",
    "This is complete repository history.",
    "The change improved reliability by 99%.",
    "The repository contains 999 commits.",
    "The repository contains 1 commit.",
  ])("rejects prohibited or unsupported policy claim: %s", (text) => {
    expect(() =>
      validateGroundedDraftOutput(
        JSON.stringify({
          sentences: [{ text, evidenceIds: ["evidence-1"] }],
          caveats: [],
        }),
        bundle,
        16 * 1024,
      ),
    ).toThrow();
  });
});
