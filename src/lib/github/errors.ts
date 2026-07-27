export const PROVIDER_ERROR_CODES = [
  "invalid-input",
  "not-found",
  "rate-limited",
  "auth-config",
  "upstream-unavailable",
  "timeout",
  "malformed-response",
  "unexpected",
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

/**
 * Typed failure from the public repository provider.
 *
 * Messages are written for end users and must never contain tokens,
 * authorization headers, or raw upstream bodies — tests assert this.
 */
export class PublicRepositoryProviderError extends Error {
  readonly code: ProviderErrorCode;
  /** Upstream HTTP status, when one was received. */
  readonly status: number | null;
  /** Seconds suggested by a Retry-After header, when present. */
  readonly retryAfterSeconds: number | null;
  /** ISO timestamp when the rate-limit window resets, when known. */
  readonly rateLimitResetAt: string | null;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options?: {
      status?: number | null;
      retryAfterSeconds?: number | null;
      rateLimitResetAt?: string | null;
    },
  ) {
    super(message);
    this.name = "PublicRepositoryProviderError";
    this.code = code;
    this.status = options?.status ?? null;
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
    this.rateLimitResetAt = options?.rateLimitResetAt ?? null;
  }
}

export function isProviderError(
  error: unknown,
): error is PublicRepositoryProviderError {
  return error instanceof PublicRepositoryProviderError;
}
