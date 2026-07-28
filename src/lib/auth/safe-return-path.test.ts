import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./safe-return-path";

describe("safeReturnPath", () => {
  it.each([
    ["https://example.test", "/dashboard"],
    ["//example.test/path", "/dashboard"],
    ["/\\example.test", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["", "/dashboard"],
  ])("rejects unsafe return path %s", (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });

  it("preserves an internal path and query", () => {
    expect(safeReturnPath("/dashboard/profile?tab=public")).toBe(
      "/dashboard/profile?tab=public",
    );
  });
});
