import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/auth/safe-return-path";

describe("safeReturnPath", () => {
  it.each([
    [
      "/dashboard/repositories?tab=recent",
      "/dashboard/repositories?tab=recent",
    ],
    ["https://evil.example/x", "/dashboard"],
    ["//evil.example/x", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    [null, "/dashboard"],
  ])("maps %s safely", (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });
});
