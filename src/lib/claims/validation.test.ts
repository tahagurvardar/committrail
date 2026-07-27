import { describe, expect, it } from "vitest";
import {
  CLAIM_STATEMENT_MAX_LENGTH,
  normalizeClaimStatement,
  validExpectedVersion,
} from "@/lib/claims/validation";

describe("claim validation", () => {
  it("trims plain text", () => {
    expect(normalizeClaimStatement("  Shipped a safe migration.  ")).toBe(
      "Shipped a safe migration.",
    );
  });

  it("removes control characters without rendering markup", () => {
    expect(normalizeClaimStatement("Built\u0000 <strong>facts</strong>")).toBe(
      "Built <strong>facts</strong>",
    );
  });

  it.each(["", " \n ", "x".repeat(CLAIM_STATEMENT_MAX_LENGTH + 1), null])(
    "rejects invalid statement %s",
    (value) => {
      expect(() => normalizeClaimStatement(value)).toThrow(
        "CLAIM_STATEMENT_INVALID",
      );
    },
  );

  it("accepts the maximum statement length", () => {
    expect(normalizeClaimStatement("x".repeat(500))).toHaveLength(500);
  });

  it.each([1, "2", 99])("accepts optimistic version %s", (value) => {
    expect(validExpectedVersion(value)).toBe(Number(value));
  });

  it.each([0, -1, "no", 1.5])("rejects version %s", (value) => {
    expect(() => validExpectedVersion(value)).toThrow("CLAIM_VERSION_INVALID");
  });
});
