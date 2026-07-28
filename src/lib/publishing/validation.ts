import { isIP } from "node:net";
import { PublishingError } from "@/lib/publishing/errors";

export const RESERVED_PUBLIC_SLUGS = new Set([
  "admin",
  "api",
  "about",
  "assets",
  "auth",
  "dashboard",
  "demo",
  "explore",
  "favicon",
  "health",
  "login",
  "methodology",
  "profiles",
  "projects",
  "register",
  "repositories",
  "robots",
  "settings",
  "sitemap",
  "static",
  "webhook",
  "webhooks",
]);

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const PROFILE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_CLAIM_PROHIBITED =
  /\b(best|better than|top\s*\d+|rank(?:ed|ing)?|senior(?:ity)?|junior|productiv(?:e|ity)|quality score|performance score|rockstar|10x)\b/i;
const MARKDOWN_CONTROL = /([\\`*_[\]{}()#+\-.!>|])/g;

export function normalizePlainText(
  value: unknown,
  options: { min?: number; max: number; code: string },
): string {
  if (typeof value !== "string") throw new PublishingError(options.code);
  const normalized = value.replace(CONTROL_CHARACTERS, "").trim();
  if (normalized.length < (options.min ?? 0) || normalized.length > options.max)
    throw new PublishingError(options.code);
  return normalized;
}

export function normalizeOptionalPlainText(
  value: unknown,
  options: { max: number; code: string },
): string | null {
  if (value === null || value === undefined || value === "") return null;
  return normalizePlainText(value, { ...options, min: 1 });
}

export function normalizePublicSlug(
  value: unknown,
  kind: "PROFILE" | "PROJECT",
): string {
  if (typeof value !== "string")
    throw new PublishingError("PUBLIC_SLUG_INVALID");
  if (!/^[\x00-\x7F]+$/.test(value))
    throw new PublishingError("PUBLIC_SLUG_INVALID");
  const slug = value.trim().toLowerCase();
  const maximum = kind === "PROFILE" ? 40 : 60;
  if (
    slug.length < 3 ||
    slug.length > maximum ||
    !PROFILE_SLUG.test(slug) ||
    RESERVED_PUBLIC_SLUGS.has(slug)
  )
    throw new PublishingError(
      RESERVED_PUBLIC_SLUGS.has(slug)
        ? "PUBLIC_SLUG_RESERVED"
        : "PUBLIC_SLUG_INVALID",
    );
  return slug;
}

export function normalizePublicUrl(
  value: unknown,
  code = "PUBLIC_URL_INVALID",
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = normalizePlainText(value, { min: 1, max: 500, code });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PublishingError(code);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new PublishingError(code);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const comparableHostname = hostname.replace(/^\[|\]$/g, "");
  if (isPrivateHostname(comparableHostname)) throw new PublishingError(code);
  url.hostname = hostname;
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  return url.toString();
}

export function normalizePublicClaimStatement(value: unknown): string {
  const statement = normalizePlainText(value, {
    min: 1,
    max: 500,
    code: "PUBLIC_CLAIM_TEXT_INVALID",
  });
  if (PUBLIC_CLAIM_PROHIBITED.test(statement))
    throw new PublishingError("PUBLIC_CLAIM_POLICY_REJECTED");
  return statement;
}

export function assertNoPrivateSourceIdentifiers(
  values: Array<string | null | undefined>,
  forbiddenValues: string[],
): void {
  const text = values
    .filter((value): value is string => Boolean(value))
    .join("\n");
  if (
    /https?:\/\/(?:www\.)?github\.com\b/i.test(text) ||
    /\b[0-9a-f]{7,40}\b/i.test(text) ||
    /\b(?:pr|pull request|issue|workflow|release)\s*#?\d+\b/i.test(text)
  )
    throw new PublishingError("PRIVATE_SOURCE_IDENTIFIER_FORBIDDEN");
  const normalized = text.toLocaleLowerCase("en-US");
  for (const raw of forbiddenValues) {
    const forbidden = raw.trim().toLocaleLowerCase("en-US");
    if (forbidden.length < 3) continue;
    if (/^\d+$/.test(forbidden)) {
      if (
        new RegExp(
          `(?:#|\\b(?:pr|pull request|issue|workflow|release)\\s*)${escapeRegExp(forbidden)}\\b`,
          "i",
        ).test(text)
      )
        throw new PublishingError("PRIVATE_SOURCE_IDENTIFIER_FORBIDDEN");
      continue;
    }
    if (normalized.includes(forbidden))
      throw new PublishingError("PRIVATE_SOURCE_IDENTIFIER_FORBIDDEN");
  }
}

export function normalizeTechnologyLabels(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    const label = normalizePlainText(item, {
      min: 1,
      max: 40,
      code: "TECHNOLOGY_LABEL_INVALID",
    });
    const key = label.toLocaleLowerCase("en-US");
    if (!seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  }
  if (labels.length > 12) throw new PublishingError("TOO_MANY_TECHNOLOGIES");
  return labels;
}

export function validExpectedVersion(value: unknown): number {
  const version =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(version) || version < 1)
    throw new PublishingError("PUBLICATION_VERSION_INVALID");
  return version;
}

export function escapeMarkdown(value: string): string {
  return value.replace(MARKDOWN_CONTROL, "\\$1");
}

export function safeDownloadFilename(value: string, extension: string): string {
  const base = value
    .replace(CONTROL_CHARACTERS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const safeBase = base || "committrail-output";
  const safeExtension = /^(txt|md|json)$/.test(extension) ? extension : "txt";
  return `${safeBase}.${safeExtension}`;
}

function isPrivateHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  )
    return true;
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    const parts = hostname.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
  if (ipVersion === 6)
    return (
      hostname === "::1" ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe8") ||
      hostname.startsWith("fe9") ||
      hostname.startsWith("fea") ||
      hostname.startsWith("feb")
    );
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
