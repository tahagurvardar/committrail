import { afterEach, describe, expect, it } from "vitest";
import { getDraftProviderConfig, isLoopbackHost } from "@/lib/drafting/config";

describe("draft provider configuration", () => {
  const original = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  });

  it("is disabled by default", () => {
    delete process.env.DRAFT_PROVIDER;
    const config = getDraftProviderConfig();
    expect(config.mode).toBe("disabled");
    expect(config.descriptor.configured).toBe(false);
    expect(config.descriptor.selectedEvidenceLeavesProcess).toBe(false);
  });

  it("classifies HTTP loopback as local without requiring an API key", () => {
    const config = getDraftProviderConfig({
      DRAFT_PROVIDER: "openai-compatible",
      DRAFT_PROVIDER_BASE_URL: "http://127.0.0.1:11434/v1",
      DRAFT_PROVIDER_MODEL: "local-model",
    });
    expect(config.mode).toBe("openai-compatible");
    expect(config.descriptor.classification).toBe("LOCAL");
    expect(config.descriptor.selectedEvidenceLeavesProcess).toBe(true);
    if (config.mode === "openai-compatible") expect(config.apiKey).toBeNull();
  });

  it("classifies an HTTPS origin as external", () => {
    const config = getDraftProviderConfig({
      DRAFT_PROVIDER: "openai-compatible",
      DRAFT_PROVIDER_BASE_URL: "https://models.example.test/v1",
      DRAFT_PROVIDER_MODEL: "configured-model",
      DRAFT_PROVIDER_API_KEY: "test-only-key",
    });
    expect(config.descriptor.classification).toBe("EXTERNAL");
    expect(config.descriptor.selectedEvidenceLeavesProcess).toBe(true);
  });

  it.each([
    "http://models.example.test/v1",
    "ftp://models.example.test/v1",
    "https://user:password@models.example.test/v1",
    "https://models.example.test/v1?tenant=private",
    "https://models.example.test/v1#fragment",
  ])("rejects unsafe base URL %s", (baseUrl) => {
    expect(() =>
      getDraftProviderConfig({
        DRAFT_PROVIDER: "openai-compatible",
        DRAFT_PROVIDER_BASE_URL: baseUrl,
        DRAFT_PROVIDER_MODEL: "configured-model",
      }),
    ).toThrow();
  });

  it("recognizes only loopback host forms", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.42.3.9")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("local.example.test")).toBe(false);
  });

  it("bounds time and byte configuration", () => {
    expect(() =>
      getDraftProviderConfig({
        DRAFT_PROVIDER: "openai-compatible",
        DRAFT_PROVIDER_BASE_URL: "http://localhost:11434/v1",
        DRAFT_PROVIDER_MODEL: "local-model",
        DRAFT_PROVIDER_TIMEOUT_MS: "999999",
      }),
    ).toThrow("DRAFT_PROVIDER_INVALID_CONFIGURATION");
  });
});
