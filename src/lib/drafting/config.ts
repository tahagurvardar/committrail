import "server-only";

import { createHash } from "node:crypto";
import { DraftingError } from "@/lib/drafting/errors";
import {
  DRAFT_DEFAULT_MAX_INPUT_BYTES,
  DRAFT_DEFAULT_MAX_OUTPUT_BYTES,
  DRAFT_DEFAULT_TIMEOUT_MS,
  DRAFT_MAX_EVIDENCE_COUNT,
  type DraftProviderDescriptor,
} from "@/lib/drafting/types";

export interface DisabledDraftProviderConfig {
  mode: "disabled";
  descriptor: DraftProviderDescriptor & { configured: false };
}

export interface OpenAICompatibleDraftProviderConfig {
  mode: "openai-compatible";
  baseUrl: URL;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
  descriptor: DraftProviderDescriptor & { configured: true };
}

export type DraftProviderConfig =
  DisabledDraftProviderConfig | OpenAICompatibleDraftProviderConfig;

export function getDraftProviderConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DraftProviderConfig {
  const mode = (env.DRAFT_PROVIDER ?? "disabled").trim().toLowerCase();
  if (mode === "" || mode === "disabled") {
    return {
      mode: "disabled",
      descriptor: {
        kind: "OPENAI_COMPATIBLE",
        classification: "LOCAL",
        modelLabel: "Not configured",
        configured: false,
        providerIdentityHash: identityHash("disabled"),
        maximumEvidenceCount: DRAFT_MAX_EVIDENCE_COUNT,
        maximumRequestBytes: boundedInteger(
          env.DRAFT_PROVIDER_MAX_INPUT_BYTES,
          DRAFT_DEFAULT_MAX_INPUT_BYTES,
          4_096,
          1024 * 1024,
        ),
        maximumOutputBytes: boundedInteger(
          env.DRAFT_PROVIDER_MAX_OUTPUT_BYTES,
          DRAFT_DEFAULT_MAX_OUTPUT_BYTES,
          1_024,
          128 * 1024,
        ),
        selectedEvidenceLeavesProcess: false,
      },
    };
  }
  if (mode !== "openai-compatible")
    throw new DraftingError("DRAFT_PROVIDER_UNSUPPORTED");

  const rawBaseUrl = env.DRAFT_PROVIDER_BASE_URL?.trim();
  const model = env.DRAFT_PROVIDER_MODEL?.trim();
  if (!rawBaseUrl || !model)
    throw new DraftingError("DRAFT_PROVIDER_INVALID_CONFIGURATION");
  if (model.length > 120 || /[\u0000-\u001f\u007f]/.test(model))
    throw new DraftingError("DRAFT_PROVIDER_INVALID_CONFIGURATION");

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new DraftingError("DRAFT_PROVIDER_INVALID_CONFIGURATION");
  }
  if (
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    !["http:", "https:"].includes(baseUrl.protocol)
  )
    throw new DraftingError("DRAFT_PROVIDER_INVALID_CONFIGURATION");

  const local = isLoopbackHost(baseUrl.hostname);
  if (baseUrl.protocol === "http:" && !local)
    throw new DraftingError("DRAFT_PROVIDER_INSECURE_EXTERNAL_URL");
  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "") + "/";

  const classification = local ? "LOCAL" : "EXTERNAL";
  const maximumRequestBytes = boundedInteger(
    env.DRAFT_PROVIDER_MAX_INPUT_BYTES,
    DRAFT_DEFAULT_MAX_INPUT_BYTES,
    4_096,
    1024 * 1024,
  );
  const maximumOutputBytes = boundedInteger(
    env.DRAFT_PROVIDER_MAX_OUTPUT_BYTES,
    DRAFT_DEFAULT_MAX_OUTPUT_BYTES,
    1_024,
    128 * 1024,
  );
  const timeoutMs = boundedInteger(
    env.DRAFT_PROVIDER_TIMEOUT_MS,
    DRAFT_DEFAULT_TIMEOUT_MS,
    1_000,
    120_000,
  );
  const providerIdentityHash = identityHash(
    [
      "openai-compatible",
      classification,
      baseUrl.origin,
      baseUrl.pathname,
      model,
    ].join(":"),
  );
  return {
    mode: "openai-compatible",
    baseUrl,
    apiKey: env.DRAFT_PROVIDER_API_KEY?.trim() || null,
    model,
    timeoutMs,
    descriptor: {
      kind: "OPENAI_COMPATIBLE",
      classification,
      modelLabel: model,
      configured: true,
      providerIdentityHash,
      maximumEvidenceCount: DRAFT_MAX_EVIDENCE_COUNT,
      maximumRequestBytes,
      maximumOutputBytes,
      selectedEvidenceLeavesProcess: true,
    },
  };
}

export function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

function identityHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw))
    throw new DraftingError("DRAFT_PROVIDER_INVALID_CONFIGURATION");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new DraftingError("DRAFT_PROVIDER_INVALID_CONFIGURATION");
  return value;
}
