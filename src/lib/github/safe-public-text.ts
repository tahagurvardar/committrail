const CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function safePublicText(
  value: unknown,
  maxLength: number,
  options?: { firstLine?: boolean },
): string | null {
  if (typeof value !== "string" || maxLength < 1) {
    return null;
  }
  const selected = options?.firstLine
    ? value.replace(/\r\n?/g, "\n").split("\n", 1)[0]
    : value;
  const cleaned = selected
    .replace(CONTROL_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) {
    return null;
  }
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  const slice = cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd();
  return `${slice}…`;
}
