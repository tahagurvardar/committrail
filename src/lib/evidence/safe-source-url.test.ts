import { describe, expect, it } from "vitest";
import { safeGitHubSourceUrl } from "@/lib/evidence/safe-source-url";

describe("safe GitHub evidence links", () => {
  it("accepts canonical HTTPS GitHub links", () => {
    expect(safeGitHubSourceUrl("https://github.com/owner/repo/pull/1")).toBe(
      "https://github.com/owner/repo/pull/1",
    );
  });

  it.each([
    "http://github.com/owner/repo",
    "https://evil.example/owner/repo",
    "javascript:alert(1)",
    "not a URL",
  ])("rejects unsafe source %s", (value) => {
    expect(safeGitHubSourceUrl(value)).toBeNull();
  });
});
