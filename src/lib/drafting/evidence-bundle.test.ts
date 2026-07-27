import { describe, expect, it } from "vitest";
import { buildEvidenceBundleFromRecords } from "@/lib/drafting/evidence-bundle";

const base = {
  id: "c123456789012345678901234",
  evidenceId: "commit:abc123",
  evidenceType: "commit",
  occurredAt: new Date("2026-07-01T00:00:00.000Z"),
  title: "Add bounded webhook processing",
  canonicalUrl: "https://github.com/example/project/commit/abc123",
  confidence: "fact",
  normalizedContentHash: "a".repeat(64),
  sourceAvailability: "AVAILABLE" as const,
  factualPayload: {
    sha: "abc123",
    shortSha: "abc123",
    committedAt: "2026-07-01T00:00:00.000Z",
    verification: "verified",
    authorDisplayName: "Private Person",
    email: "private@example.test",
    body: "raw private body",
  },
};

describe("grounded evidence bundles", () => {
  it("is deterministically ordered and hashed", () => {
    const second = {
      ...base,
      id: "c223456789012345678901234",
      evidenceId: "commit:def456",
      normalizedContentHash: "b".repeat(64),
      factualPayload: { ...base.factualPayload, sha: "def456" },
    };
    const left = buildEvidenceBundleFromRecords([second, base], 64 * 1024);
    const right = buildEvidenceBundleFromRecords([base, second], 64 * 1024);
    expect(left).toEqual(right);
    expect(left.bundle.orderedEvidenceIds).toEqual([base.id, second.id]);
  });

  it("omits raw and private fields", () => {
    const built = buildEvidenceBundleFromRecords([base], 64 * 1024);
    expect(built.bundle.evidence[0].facts).toEqual({
      sha: "abc123",
      shortSha: "abc123",
      committedAt: "2026-07-01T00:00:00.000Z",
      verification: "verified",
    });
    expect(JSON.stringify(built)).not.toContain("private@example.test");
    expect(JSON.stringify(built)).not.toContain("raw private body");
  });

  it("uses a strict nested whitelist for issue labels", () => {
    const built = buildEvidenceBundleFromRecords(
      [
        {
          ...base,
          evidenceId: "issue:42",
          evidenceType: "issue",
          canonicalUrl: "https://github.com/example/project/issues/42",
          factualPayload: {
            number: 42,
            labels: [
              {
                name: "security",
                description: "private label description",
                url: "https://api.github.com/private",
              },
            ],
          },
        },
      ],
      64 * 1024,
    );
    expect(built.bundle.evidence[0].facts).toEqual({
      number: 42,
      labels: ["security"],
    });
    expect(JSON.stringify(built)).not.toContain("private label description");
    expect(JSON.stringify(built)).not.toContain("api.github.com");
  });

  it("rejects duplicates, unavailable evidence, unsafe URLs, and byte overflow", () => {
    expect(() =>
      buildEvidenceBundleFromRecords([base, base], 64 * 1024),
    ).toThrow("DRAFT_DUPLICATE_EVIDENCE");
    expect(() =>
      buildEvidenceBundleFromRecords(
        [{ ...base, sourceAvailability: "DELETED" }],
        64 * 1024,
      ),
    ).toThrow("DRAFT_EVIDENCE_UNAVAILABLE");
    expect(() =>
      buildEvidenceBundleFromRecords(
        [{ ...base, canonicalUrl: "https://evil.example.test/fact" }],
        64 * 1024,
      ),
    ).toThrow("DRAFT_EVIDENCE_UNSAFE_URL");
    expect(() => buildEvidenceBundleFromRecords([base], 20)).toThrow(
      "DRAFT_EVIDENCE_BUNDLE_TOO_LARGE",
    );
  });
});
