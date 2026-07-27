export const CLAIM_STATEMENT_MAX_LENGTH = 500;

export function normalizeClaimStatement(value: unknown): string {
  if (typeof value !== "string") throw new Error("CLAIM_STATEMENT_INVALID");
  const normalized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (normalized.length < 1 || normalized.length > CLAIM_STATEMENT_MAX_LENGTH)
    throw new Error("CLAIM_STATEMENT_INVALID");
  return normalized;
}

export function validExpectedVersion(value: unknown): number {
  const version =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(version) || version < 1)
    throw new Error("CLAIM_VERSION_INVALID");
  return version;
}
