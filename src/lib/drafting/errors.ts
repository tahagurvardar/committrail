export class DraftingError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly retryAt: Date | null;

  constructor(
    code: string,
    options?: { retryable?: boolean; retryAt?: Date | null },
  ) {
    super(code);
    this.name = "DraftingError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.retryAt = options?.retryAt ?? null;
  }
}

export function isDraftingError(error: unknown): error is DraftingError {
  return error instanceof DraftingError;
}
