import { describe, expect, it, vi } from "vitest";
import type { OpenAICompatibleDraftProviderConfig } from "@/lib/drafting/config";
import { OpenAICompatibleDraftProvider } from "@/lib/drafting/openai-compatible-provider";

function config(
  overrides: Partial<OpenAICompatibleDraftProviderConfig> = {},
): OpenAICompatibleDraftProviderConfig {
  return {
    mode: "openai-compatible",
    baseUrl: new URL("https://models.example.test/v1/"),
    apiKey: "test-secret-key",
    model: "configured-model",
    timeoutMs: 5_000,
    descriptor: {
      kind: "OPENAI_COMPATIBLE",
      classification: "EXTERNAL",
      modelLabel: "configured-model",
      configured: true,
      providerIdentityHash: "a".repeat(64),
      maximumEvidenceCount: 12,
      maximumRequestBytes: 64 * 1024,
      maximumOutputBytes: 16 * 1024,
      selectedEvidenceLeavesProcess: true,
    },
    ...overrides,
  };
}

const request = {
  intent: "Describe the recorded change",
  style: "CONCISE" as const,
  evidenceBundle: {
    schemaVersion: 1,
    orderedEvidenceIds: ["evidence-1"],
    contentHashes: ["a".repeat(64)],
    evidence: [
      {
        id: "evidence-1",
        type: "commit",
        occurredAt: "2026-07-01T00:00:00.000Z",
        title: "Add queue",
        sourceUrl: "https://github.com/example/project/commit/abc",
        confidence: "fact",
        contentHash: "a".repeat(64),
        facts: { sha: "abc" },
      },
    ],
  },
};

describe("OpenAI-compatible drafting transport", () => {
  it("sends a bounded server-owned request and returns only content and safe usage", async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.redirect).toBe("manual");
      expect(init.credentials).toBe("omit");
      expect(init.cache).toBe("no-store");
      expect(new Headers(init.headers).get("authorization")).toBe(
        "Bearer test-secret-key",
      );
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe("configured-model");
      expect(body.messages).toHaveLength(3);
      expect(body.tools).toBeUndefined();
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sentences: [
                  { text: "Add queue.", evidenceIds: ["evidence-1"] },
                ],
                caveats: [],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      });
    });
    const provider = new OpenAICompatibleDraftProvider(config(), fetcher);
    const result = await provider.generate(request, { requestId: "request-1" });
    expect(result.content).toContain("evidence-1");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 6 });
    expect(fetcher).toHaveBeenCalledWith(
      "https://models.example.test/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("does not send authorization when a local provider has no key", async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).has("authorization")).toBe(false);
      return Response.json({
        choices: [{ message: { content: '{"sentences":[],"caveats":[]}' } }],
      });
    });
    const provider = new OpenAICompatibleDraftProvider(
      config({
        baseUrl: new URL("http://localhost:11434/v1/"),
        apiKey: null,
        descriptor: {
          ...config().descriptor,
          classification: "LOCAL",
          selectedEvidenceLeavesProcess: true,
        },
      }),
      fetcher,
    );
    await provider.generate(request, { requestId: "request-1" });
  });

  it.each([
    [302, "DRAFT_PROVIDER_REDIRECT_REJECTED"],
    [400, "DRAFT_PROVIDER_REJECTED_REQUEST"],
    [429, "DRAFT_PROVIDER_RATE_LIMITED"],
    [503, "DRAFT_PROVIDER_UNAVAILABLE"],
  ])("classifies HTTP %s without retaining its body", async (status, code) => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { error: "private upstream body with test-secret-key" },
        { status },
      ),
    );
    const provider = new OpenAICompatibleDraftProvider(config(), fetcher);
    await expect(
      provider.generate(request, { requestId: "request-1" }),
    ).rejects.toThrow(code);
    try {
      await provider.generate(request, { requestId: "request-2" });
    } catch (error) {
      expect(String(error)).not.toContain("test-secret-key");
      expect(String(error)).not.toContain("private upstream body");
    }
  });

  it("rejects a declared response above the byte limit", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("oversized", {
          headers: { "Content-Length": "20000" },
        }),
    );
    const provider = new OpenAICompatibleDraftProvider(config(), fetcher);
    await expect(
      provider.generate(request, { requestId: "request-1" }),
    ).rejects.toThrow("DRAFT_OUTPUT_TOO_LARGE");
  });

  it("converts an aborted request into a retryable timeout", async () => {
    const fetcher = vi.fn(
      async (_url: string, init: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const provider = new OpenAICompatibleDraftProvider(
      config({ timeoutMs: 10 }),
      fetcher,
    );
    await expect(
      provider.generate(request, { requestId: "request-1" }),
    ).rejects.toMatchObject({
      code: "DRAFT_PROVIDER_TIMEOUT",
      retryable: true,
    });
  });
});
