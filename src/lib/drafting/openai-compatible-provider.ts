import "server-only";

import { DraftingError, isDraftingError } from "@/lib/drafting/errors";
import { buildDraftPrompt } from "@/lib/drafting/prompt-template";
import type { OpenAICompatibleDraftProviderConfig } from "@/lib/drafting/config";
import type {
  GroundedDraftProvider,
  GroundedDraftProviderContext,
  GroundedDraftProviderRequest,
  GroundedDraftProviderResponse,
} from "@/lib/drafting/types";

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class OpenAICompatibleDraftProvider implements GroundedDraftProvider {
  readonly descriptor;

  constructor(
    private readonly config: OpenAICompatibleDraftProviderConfig,
    private readonly fetchImplementation: FetchLike = fetch,
  ) {
    this.descriptor = config.descriptor;
  }

  async generate(
    request: GroundedDraftProviderRequest,
    context: GroundedDraftProviderContext,
  ): Promise<GroundedDraftProviderResponse> {
    const endpoint = new URL("chat/completions", this.config.baseUrl);
    if (endpoint.origin !== this.config.baseUrl.origin)
      throw new DraftingError("DRAFT_PROVIDER_INVALID_CONFIGURATION");
    const body = JSON.stringify({
      model: this.config.model,
      messages: buildDraftPrompt(request),
      response_format: { type: "json_object" },
      temperature: 0,
      stream: false,
    });
    if (Buffer.byteLength(body, "utf8") > this.descriptor.maximumRequestBytes)
      throw new DraftingError("DRAFT_INPUT_TOO_LARGE");

    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(),
      this.config.timeoutMs,
    );
    const signal = combineSignals(context.signal, timeoutController.signal);
    let response: Response;
    try {
      response = await this.fetchImplementation(endpoint.toString(), {
        method: "POST",
        redirect: "manual",
        cache: "no-store",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body,
        signal,
      });
    } catch {
      clearTimeout(timeout);
      if (signal.aborted)
        throw new DraftingError("DRAFT_PROVIDER_TIMEOUT", {
          retryable: true,
        });
      throw new DraftingError("DRAFT_PROVIDER_CONNECTION_FAILED", {
        retryable: true,
      });
    }
    try {
      if (response.status >= 300 && response.status < 400)
        throw new DraftingError("DRAFT_PROVIDER_REDIRECT_REJECTED");
      if (response.status === 429)
        throw new DraftingError("DRAFT_PROVIDER_RATE_LIMITED", {
          retryable: true,
          retryAt: retryAtFrom(response.headers),
        });
      if (response.status >= 500)
        throw new DraftingError("DRAFT_PROVIDER_UNAVAILABLE", {
          retryable: true,
          retryAt: retryAtFrom(response.headers),
        });
      if (!response.ok)
        throw new DraftingError("DRAFT_PROVIDER_REJECTED_REQUEST");

      const text = await readBoundedText(
        response,
        this.descriptor.maximumOutputBytes,
      );
      let envelope: unknown;
      try {
        envelope = JSON.parse(text);
      } catch {
        throw new DraftingError("DRAFT_PROVIDER_MALFORMED_RESPONSE");
      }
      const content = responseContent(envelope);
      const byteSize = Buffer.byteLength(content, "utf8");
      if (byteSize > this.descriptor.maximumOutputBytes)
        throw new DraftingError("DRAFT_OUTPUT_TOO_LARGE");
      const usage = responseUsage(envelope);
      return { content, byteSize, ...(usage ? { usage } : {}) };
    } catch (error) {
      if (signal.aborted && !isDraftingError(error))
        throw new DraftingError("DRAFT_PROVIDER_TIMEOUT", {
          retryable: true,
        });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readBoundedText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes)
    throw new DraftingError("DRAFT_OUTPUT_TOO_LARGE");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let output = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximumBytes)
        throw new DraftingError("DRAFT_OUTPUT_TOO_LARGE");
      output += decoder.decode(part.value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function responseContent(value: unknown): string {
  const record = asRecord(value);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const first = asRecord(choices[0]);
  const message = asRecord(first?.message);
  if (typeof message?.content !== "string")
    throw new DraftingError("DRAFT_PROVIDER_MALFORMED_RESPONSE");
  return message.content;
}

function responseUsage(value: unknown) {
  const usage = asRecord(asRecord(value)?.usage);
  const inputTokens = safeTokenCount(usage?.prompt_tokens);
  const outputTokens = safeTokenCount(usage?.completion_tokens);
  return inputTokens === undefined && outputTokens === undefined
    ? undefined
    : { inputTokens, outputTokens };
}

function safeTokenCount(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 1_000_000_000
    ? value
    : undefined;
}

function retryAtFrom(headers: Headers): Date | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const now = Date.now();
  const maximumRetryAt = now + 30 * 60 * 1000;
  if (/^\d+$/.test(raw)) {
    const seconds = Math.min(Number(raw), 30 * 60);
    return new Date(now + seconds * 1000);
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) && parsed > now && parsed <= maximumRetryAt
    ? new Date(parsed)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function combineSignals(
  first: AbortSignal | undefined,
  second: AbortSignal,
): AbortSignal {
  return first ? AbortSignal.any([first, second]) : second;
}
