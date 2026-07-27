import { afterEach, describe, expect, it } from "vitest";
import {
  getWebhookConfiguration,
  requireWebhookSecret,
  WEBHOOK_BODY_LIMIT_BYTES,
} from "@/lib/webhooks/config";

const original = process.env.GITHUB_WEBHOOK_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
  else process.env.GITHUB_WEBHOOK_SECRET = original;
});

describe("webhook configuration", () => {
  it("is lazy and safely reports missing configuration", () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    expect(getWebhookConfiguration()).toEqual({
      configured: false,
      bodyLimitBytes: WEBHOOK_BODY_LIMIT_BYTES,
    });
    expect(() => requireWebhookSecret()).toThrow(
      "WEBHOOK_CONFIGURATION_UNAVAILABLE",
    );
  });

  it("rejects a short secret", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "too-short";
    expect(getWebhookConfiguration().configured).toBe(false);
  });

  it("accepts a high-entropy-length configured secret without exposing it", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "phase-3-test-secret-32-bytes-long!!";
    expect(getWebhookConfiguration().configured).toBe(true);
    expect(JSON.stringify(getWebhookConfiguration())).not.toContain("phase-3");
  });

  it("documents GitHub's 25 MiB-compatible request cap", () => {
    expect(WEBHOOK_BODY_LIMIT_BYTES).toBe(25 * 1024 * 1024);
  });
});
