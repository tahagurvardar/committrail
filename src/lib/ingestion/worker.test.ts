import { describe, expect, it } from "vitest";
import {
  classifyIngestionError,
  INGESTION_BATCH_SIZE,
  INGESTION_CONCURRENCY,
  INGESTION_LEASE_MS,
  ingestionBackoffMs,
} from "@/lib/ingestion/worker";
import { PublicRepositoryProviderError } from "@/lib/github/errors";
import { DraftingError } from "@/lib/drafting/errors";

describe("ingestion worker policy", () => {
  it("uses a bounded batch, concurrency, and stale lease", () => {
    expect(INGESTION_BATCH_SIZE).toBe(10);
    expect(INGESTION_CONCURRENCY).toBe(2);
    expect(INGESTION_LEASE_MS).toBe(120_000);
  });

  it.each([
    [1, 30_000],
    [2, 60_000],
    [3, 120_000],
    [4, 240_000],
    [10, 1_800_000],
  ])(
    "computes deterministic exponential backoff for attempt %i",
    (attempt, delay) => {
      expect(ingestionBackoffMs(attempt)).toBe(delay);
    },
  );

  it.each([
    "REPOSITORY_NOT_ACCESSIBLE",
    "INSTALLATION_SUSPENDED",
    "UNSUPPORTED_RECONCILIATION_KIND",
    "GITHUB_APP_INVALID_INPUT",
  ])("does not retry permanent error %s", (code) => {
    expect(classifyIngestionError(new Error(code))).toMatchObject({
      code,
      retryable: false,
    });
  });

  it("retries sanitized transient errors", () => {
    expect(classifyIngestionError(new Error("GITHUB_RATE_LIMITED"))).toEqual({
      code: "GITHUB_RATE_LIMITED",
      retryable: true,
      retryAt: null,
    });
  });

  it("honours a reliable later rate-limit reset", () => {
    const reset = new Date(Date.now() + 60_000).toISOString();
    const error = Object.assign(new Error("GITHUB_RATE_LIMITED"), {
      rateLimitResetAt: reset,
    });
    expect(classifyIngestionError(error).retryAt?.toISOString()).toBe(reset);
  });

  it("classifies typed provider authorization as permanent without its prose", () => {
    expect(
      classifyIngestionError(
        new PublicRepositoryProviderError(
          "auth-config",
          "Private upstream explanation.",
        ),
      ),
    ).toMatchObject({
      code: "GITHUB_AUTHORIZATION_FAILED",
      retryable: false,
    });
  });

  it("sanitizes arbitrary error text", () => {
    expect(
      classifyIngestionError(new Error("token secret private text")),
    ).toMatchObject({
      code: "INGESTION_FAILURE",
      retryable: true,
    });
  });

  it("preserves only typed drafting retry metadata", () => {
    const retryAt = new Date(Date.now() + 30_000);
    expect(
      classifyIngestionError(
        new DraftingError("DRAFT_PROVIDER_RATE_LIMITED", {
          retryable: true,
          retryAt,
        }),
      ),
    ).toEqual({
      code: "DRAFT_PROVIDER_RATE_LIMITED",
      retryable: true,
      retryAt,
    });
    expect(
      classifyIngestionError(
        new DraftingError("DRAFT_OUTPUT_UNKNOWN_CITATION"),
      ),
    ).toMatchObject({
      code: "DRAFT_OUTPUT_UNKNOWN_CITATION",
      retryable: false,
    });
  });
});
