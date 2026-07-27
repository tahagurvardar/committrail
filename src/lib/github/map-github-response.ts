import { PublicRepositoryProviderError } from "@/lib/github/errors";
import type {
  LanguageShare,
  PublicRepositorySnapshot,
  RateLimitInfo,
  ReadmeInfo,
} from "@/lib/github/types";

/**
 * Validation + mapping from raw GitHub JSON to the product-owned snapshot.
 *
 * GitHub is an external boundary: nothing is blindly cast. Required fields
 * are checked and a typed malformed-response error is thrown when they are
 * missing — no invented fallback values. Error messages name the field only,
 * never the payload.
 */

const README_MAX_DECODED_BYTES = 64 * 1024;
const README_EXCERPT_MAX_CHARS = 500;
const GITHUB_WEB_HOSTS = new Set(["github.com", "www.github.com"]);

function malformed(field: string): PublicRepositoryProviderError {
  return new PublicRepositoryProviderError(
    "malformed-response",
    `GitHub returned a response missing the expected "${field}" field.`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw malformed(field);
  }
  return value;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw malformed(field);
  }
  return value;
}

function expectNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw malformed(field);
  }
  return value;
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw malformed(field);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Accepts only well-formed absolute http(s) URLs; anything else → null. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    if (url.username !== "" || url.password !== "") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** Accepts only canonical HTTPS links on GitHub's web origin. */
function safeGitHubUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value);
  if (safe === null) {
    return null;
  }
  const url = new URL(safe);
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    !GITHUB_WEB_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return null;
  }
  return url.toString();
}

/** Keeps next/image remote loading within the configured avatar origin. */
function safeAvatarUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value);
  if (safe === null) {
    return null;
  }
  const url = new URL(safe);
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.hostname.toLowerCase() !== "avatars.githubusercontent.com"
  ) {
    return null;
  }
  return url.toString();
}

export function mapLanguages(raw: unknown): LanguageShare[] {
  if (!isRecord(raw)) {
    throw malformed("languages");
  }
  const entries: Array<{ name: string; bytes: number }> = [];
  for (const [name, bytes] of Object.entries(raw)) {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
      throw malformed(`languages.${name}`);
    }
    if (bytes > 0) {
      entries.push({ name, bytes });
    }
  }
  entries.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total === 0) {
    return [];
  }
  return entries.map((entry) => ({
    name: entry.name,
    bytes: entry.bytes,
    percent: Math.round((entry.bytes / total) * 1000) / 10,
  }));
}

/**
 * Turns untrusted base64 README content into a bounded plain-text excerpt.
 * Never returns markup; the UI renders the result as escaped text only.
 */
export function buildReadmeExcerpt(
  content: string,
  maxChars: number = README_EXCERPT_MAX_CHARS,
): { excerpt: string | null; truncated: boolean } {
  const compact = content.replace(/\s/g, "");
  if (
    compact.length === 0 ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)
  ) {
    return { excerpt: null, truncated: false };
  }

  // Decode only complete base64 blocks that cannot exceed the byte cap.
  const capChars = Math.floor(README_MAX_DECODED_BYTES / 3) * 4;
  const capped = compact.slice(0, capChars);
  let text: string;
  try {
    const decoded = Buffer.from(capped, "base64");
    if (decoded.byteLength > README_MAX_DECODED_BYTES) {
      return { excerpt: null, truncated: true };
    }
    text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch {
    return { excerpt: null, truncated: false };
  }

  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>\n]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)\n]*\)/g, "")
    .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (cleaned.length === 0) {
    return { excerpt: null, truncated: compact.length > capChars };
  }

  if (cleaned.length <= maxChars) {
    return {
      excerpt: cleaned,
      truncated: compact.length > capChars,
    };
  }

  const contentLimit = Math.max(0, maxChars - 1);
  const slice = cleaned.slice(0, contentLimit);
  const lastBreak = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\n"));
  const excerpt =
    (lastBreak > contentLimit * 0.6
      ? slice.slice(0, lastBreak)
      : slice
    ).trimEnd() + "…";
  return { excerpt, truncated: true };
}

export function mapReadme(raw: unknown): ReadmeInfo {
  if (raw === null) {
    return {
      present: false,
      path: null,
      htmlUrl: null,
      excerpt: null,
      truncated: false,
    };
  }
  const record = expectRecord(raw, "readme");
  const path = optionalString(record.path);
  const htmlUrl = safeGitHubUrl(record.html_url);
  const encoding = optionalString(record.encoding);
  const content = optionalString(record.content);

  if (encoding !== "base64" || content === null) {
    // Present but not excerptable (e.g. too large for the content API).
    return { present: true, path, htmlUrl, excerpt: null, truncated: true };
  }
  const { excerpt, truncated } = buildReadmeExcerpt(content);
  return { present: true, path, htmlUrl, excerpt, truncated };
}

function parseNonNegativeInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function readRateLimit(headers: Headers): RateLimitInfo | null {
  const limit = parseNonNegativeInt(headers.get("x-ratelimit-limit"));
  const remaining = parseNonNegativeInt(headers.get("x-ratelimit-remaining"));
  const resetSeconds = parseNonNegativeInt(headers.get("x-ratelimit-reset"));
  if (limit === null && remaining === null && resetSeconds === null) {
    return null;
  }
  return {
    limit,
    remaining,
    resetAt:
      resetSeconds === null ||
      !Number.isFinite(new Date(resetSeconds * 1000).getTime())
        ? null
        : new Date(resetSeconds * 1000).toISOString(),
  };
}

export function mapRepositorySnapshot(input: {
  metadata: unknown;
  languages: unknown;
  readme: unknown;
  fetchedAt: string;
  rateLimit: RateLimitInfo | null;
  allowPrivate?: boolean;
}): PublicRepositorySnapshot {
  const metadata = expectRecord(input.metadata, "repository");
  const ownerRecord = expectRecord(metadata.owner, "owner");

  const isPrivate = expectBoolean(metadata.private, "private");
  if (isPrivate && !input.allowPrivate) {
    // Phase 1 never renders private repositories, regardless of token scope.
    throw new PublicRepositoryProviderError(
      "not-found",
      "Repository not found or not publicly accessible.",
      { status: 404 },
    );
  }

  const licenseRecord = isRecord(metadata.license) ? metadata.license : null;
  const license =
    licenseRecord === null
      ? null
      : {
          name: expectString(licenseRecord.name, "license.name"),
          spdxId: optionalString(licenseRecord.spdx_id),
        };

  const topics = Array.isArray(metadata.topics)
    ? metadata.topics.filter(
        (topic): topic is string => typeof topic === "string",
      )
    : [];

  return {
    identity: {
      owner: expectString(ownerRecord.login, "owner.login"),
      name: expectString(metadata.name, "name"),
      fullName: expectString(metadata.full_name, "full_name"),
      url:
        safeGitHubUrl(metadata.html_url) ??
        (() => {
          throw malformed("html_url");
        })(),
    },
    description: optionalString(metadata.description),
    ownerAvatarUrl: safeAvatarUrl(ownerRecord.avatar_url),
    isPrivate,
    defaultBranch: expectString(metadata.default_branch, "default_branch"),
    archived: expectBoolean(metadata.archived, "archived"),
    fork: expectBoolean(metadata.fork, "fork"),
    isTemplate: optionalBoolean(metadata.is_template),
    createdAt: expectString(metadata.created_at, "created_at"),
    updatedAt: expectString(metadata.updated_at, "updated_at"),
    pushedAt: optionalString(metadata.pushed_at),
    stars: expectNumber(metadata.stargazers_count, "stargazers_count"),
    forks: expectNumber(metadata.forks_count, "forks_count"),
    openIssues: expectNumber(metadata.open_issues_count, "open_issues_count"),
    subscribers: optionalNumber(metadata.subscribers_count),
    license,
    topics,
    primaryLanguage: optionalString(metadata.language),
    languages: mapLanguages(input.languages),
    homepage: safeExternalUrl(metadata.homepage),
    readme: mapReadme(input.readme),
    fetchedAt: input.fetchedAt,
    rateLimit: input.rateLimit,
  };
}
