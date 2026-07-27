import type { RepositoryIdentifier } from "@/lib/github/types";

/**
 * Repository input parsing — the SSRF boundary.
 *
 * Visitor input is never fetched. This parser extracts and validates
 * { owner, repo }; the provider then builds requests only against the fixed
 * GitHub API base URL. Anything this parser rejects never reaches the network.
 *
 * Accepted forms:
 *   owner/repository
 *   github.com/owner/repository            (scheme optional)
 *   https://github.com/owner/repository
 *   https://github.com/owner/repository/
 *   https://github.com/owner/repository.git
 */

export const MAX_REPOSITORY_INPUT_LENGTH = 250;

/** GitHub owner rule: alphanumeric with single inner hyphens, max 39 chars. */
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** GitHub repository rule: letters, digits, ".", "_", "-", max 100 chars. */
const REPO_PATTERN = /^(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/;

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** Looks like it starts with a URL scheme ("https:", "javascript:", …). */
const SCHEME_PREFIX = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export type RepositoryInputErrorCode =
  | "empty"
  | "too-long"
  | "not-recognized"
  | "unsupported-scheme"
  | "unsupported-host"
  | "credentials-not-allowed"
  | "port-not-allowed"
  | "query-or-fragment"
  | "missing-repository"
  | "extra-path-segments"
  | "invalid-owner"
  | "invalid-repository";

export interface RepositoryInputError {
  code: RepositoryInputErrorCode;
  message: string;
}

export type RepositoryInputResult =
  | { ok: true; value: RepositoryIdentifier }
  | { ok: false; error: RepositoryInputError };

function fail(
  code: RepositoryInputErrorCode,
  message: string,
): RepositoryInputResult {
  return { ok: false, error: { code, message } };
}

function stripGitSuffix(segment: string): string {
  return segment.endsWith(".git") ? segment.slice(0, -4) : segment;
}

function validateParts(owner: string, repoRaw: string): RepositoryInputResult {
  const repo = stripGitSuffix(repoRaw);
  if (repo.length === 0) {
    return fail("missing-repository", "Add a repository name after the owner.");
  }
  if (!OWNER_PATTERN.test(owner)) {
    return fail(
      "invalid-owner",
      "That owner name doesn’t look like a GitHub username or organization.",
    );
  }
  if (!REPO_PATTERN.test(repo)) {
    return fail(
      "invalid-repository",
      "That repository name contains characters GitHub doesn’t allow.",
    );
  }
  return { ok: true, value: { owner, repo } };
}

function parseAsUrl(candidate: string): RepositoryInputResult {
  if (candidate.includes("?") || candidate.includes("#")) {
    return fail(
      "query-or-fragment",
      "Remove the query string or fragment — a plain repository URL is unambiguous.",
    );
  }

  // new URL() resolves "." and ".." path segments before we can inspect
  // them — reject traversal-looking and encoded input outright instead.
  if (
    candidate.includes("%") ||
    candidate.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(candidate) ||
    candidate.includes("/../") ||
    candidate.endsWith("/..") ||
    candidate.includes("/./") ||
    candidate.endsWith("/.")
  ) {
    return fail(
      "not-recognized",
      "That URL path doesn’t look like owner/repository.",
    );
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return fail(
      "not-recognized",
      "That doesn’t look like a repository. Try owner/repository or a full github.com URL.",
    );
  }

  if (url.protocol !== "https:") {
    return fail(
      "unsupported-scheme",
      "Only https:// GitHub URLs are supported.",
    );
  }
  if (url.username !== "" || url.password !== "") {
    return fail(
      "credentials-not-allowed",
      "URLs with embedded credentials aren’t supported.",
    );
  }
  if (url.port !== "") {
    return fail(
      "port-not-allowed",
      "URLs with a custom port aren’t supported.",
    );
  }
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    return fail(
      "unsupported-host",
      "Only public repositories on github.com are supported.",
    );
  }
  let path = url.pathname;
  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  const segments = path.split("/").slice(1);
  if (segments.some((segment) => segment === "")) {
    return fail(
      "not-recognized",
      "That URL path doesn’t look like owner/repository.",
    );
  }
  if (segments.length < 2) {
    return fail(
      "missing-repository",
      "The URL is missing the repository name — expected github.com/owner/repository.",
    );
  }
  if (segments.length > 2) {
    return fail(
      "extra-path-segments",
      "Link to the repository root — extra path segments like /tree or /issues aren’t supported.",
    );
  }
  return validateParts(segments[0], segments[1]);
}

/**
 * Parses free-form visitor input into a validated repository identifier.
 * Never throws; never fetches.
 */
export function parseRepositoryInput(raw: string): RepositoryInputResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fail(
      "empty",
      "Enter a repository as owner/repository or a github.com URL.",
    );
  }
  if (trimmed.length > MAX_REPOSITORY_INPUT_LENGTH) {
    return fail(
      "too-long",
      "That input is longer than any valid repository address.",
    );
  }

  if (SCHEME_PREFIX.test(trimmed)) {
    return parseAsUrl(trimmed);
  }

  // Scheme-less github.com/... paste.
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("github.com/") || lower.startsWith("www.github.com/")) {
    return parseAsUrl(`https://${trimmed}`);
  }

  if (trimmed.includes("@")) {
    return fail(
      "credentials-not-allowed",
      "SSH and credential forms aren’t supported — use owner/repository or an https github.com URL.",
    );
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "")) {
    return fail(
      "not-recognized",
      "That doesn’t look like a repository. Try owner/repository or a full github.com URL.",
    );
  }
  if (segments.length === 1) {
    return fail(
      "missing-repository",
      "Add the repository name after a slash, e.g. owner/repository.",
    );
  }
  if (segments.length > 2) {
    return fail(
      "extra-path-segments",
      "Use exactly one slash: owner/repository.",
    );
  }
  return validateParts(segments[0], segments[1]);
}

/**
 * Strict validation for route parameters that should already be normalized.
 * Returns null instead of an error taxonomy — callers map null to a 404.
 */
export function validateRepositoryIdentifier(
  owner: string,
  repo: string,
): RepositoryIdentifier | null {
  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo)) {
    return null;
  }
  return { owner, repo };
}
