import { randomUUID } from "node:crypto";

type LogLevel = "debug" | "info" | "warn" | "error";
type SafeValue = string | number | boolean | null;

const REDACTED_KEY =
  /(authorization|cookie|password|secret|token|private.?key|signature|verifier|database.?url|prompt|response|body|claim|evidence|repository)/i;

export function safeCorrelationId(value?: string | null): string {
  return value && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(value)
    ? value
    : randomUUID();
}

export function sanitizeLogMetadata(
  metadata: Readonly<Record<string, unknown>> = {},
): Record<string, SafeValue> {
  const safe: Record<string, SafeValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (REDACTED_KEY.test(key)) {
      safe[key] = "[REDACTED]";
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    )
      safe[key] =
        typeof value === "string" && value.length > 160
          ? `${value.slice(0, 157)}...`
          : value;
  }
  return safe;
}

export function logEvent(
  level: LogLevel,
  event: string,
  metadata: Readonly<Record<string, unknown>> = {},
): void {
  const safeEvent = /^[a-z0-9._-]{3,80}$/.test(event)
    ? event
    : "application.event";
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event: safeEvent,
    ...sanitizeLogMetadata(metadata),
  });
  const sink =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;
  sink(record);
}
