import { describe, expect, it } from "vitest";
import {
  assertNoPrivateSourceIdentifiers,
  escapeMarkdown,
  normalizePlainText,
  normalizePublicClaimStatement,
  normalizePublicSlug,
  normalizePublicUrl,
  normalizeTechnologyLabels,
  safeDownloadFilename,
} from "@/lib/publishing/validation";

describe("publishing validation", () => {
  it.each([
    [" Taha-Work ", "taha-work"],
    ["project-2026", "project-2026"],
  ])("normalizes safe profile slugs", (value, expected) => {
    expect(normalizePublicSlug(value, "PROFILE")).toBe(expected);
  });

  it.each([
    "ab",
    "api",
    "two--hyphens",
    "-leading",
    "trailing-",
    "has.dot",
    "has/path",
    "has%20space",
    "lookаlike",
  ])("rejects unsafe or reserved slug %s", (value) => {
    expect(() => normalizePublicSlug(value, "PROJECT")).toThrow();
  });

  it.each([
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path?secret=1",
    "https://example.com/#fragment",
    "https://localhost/path",
    "https://127.0.0.1/path",
    "https://[::1]/path",
    "javascript:alert(1)",
  ])("rejects unsafe public URL %s", (value) => {
    expect(() => normalizePublicUrl(value)).toThrow();
  });

  it("normalizes a safe HTTPS URL", () => {
    expect(normalizePublicUrl("https://example.com//work")).toBe(
      "https://example.com/work",
    );
  });

  it("removes control characters and bounds text", () => {
    expect(
      normalizePlainText(" A\u0000 safe profile ", {
        min: 1,
        max: 20,
        code: "INVALID",
      }),
    ).toBe("A safe profile");
  });

  it("rejects public ranking and productivity language", () => {
    expect(() =>
      normalizePublicClaimStatement("Ranked as a top 10 developer"),
    ).toThrow("PUBLIC_CLAIM_POLICY_REJECTED");
  });

  it("rejects private repository identifiers from public text", () => {
    expect(() =>
      assertNoPrivateSourceIdentifiers(
        ["Implemented secret-repository release #42."],
        ["private-owner", "secret-repository", "42"],
      ),
    ).toThrow("PRIVATE_SOURCE_IDENTIFIER_FORBIDDEN");
    expect(() =>
      assertNoPrivateSourceIdentifiers(
        ["Implemented a reviewed private release workflow."],
        ["private-owner", "secret-repository", "private-sha-123"],
      ),
    ).not.toThrow();
  });

  it("deduplicates bounded technology labels", () => {
    expect(
      normalizeTechnologyLabels(["TypeScript", "typescript", "SQL"]),
    ).toEqual(["TypeScript", "SQL"]);
  });

  it("escapes generated Markdown and sanitizes download filenames", () => {
    expect(escapeMarkdown("A *safe* [claim]")).toBe("A \\*safe\\* \\[claim\\]");
    expect(safeDownloadFilename("Release\r\nProject", "md")).toBe(
      "release-project.md",
    );
  });
});
