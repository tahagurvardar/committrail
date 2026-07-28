import { describe, expect, it, vi } from "vitest";
import { logEvent, safeCorrelationId, sanitizeLogMetadata } from "./logger";

describe("safe operational logging", () => {
  it("redacts sensitive fields and drops nested objects", () => {
    const result = sanitizeLogMetadata({
      authorization: "Bearer private",
      databaseUrl: "postgresql://private",
      repositoryName: "private/repository",
      status: "ready",
      nested: { secret: "value" },
    });
    expect(result).toEqual({
      authorization: "[REDACTED]",
      databaseUrl: "[REDACTED]",
      repositoryName: "[REDACTED]",
      status: "ready",
    });
  });

  it("uses only safe event names and correlation identifiers", () => {
    expect(safeCorrelationId("not-an-id")).not.toBe("not-an-id");
    const sink = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logEvent("info", "unsafe event with token", { status: "ok" });
    expect(sink).toHaveBeenCalledWith(
      expect.stringContaining("application.event"),
    );
    sink.mockRestore();
  });
});
