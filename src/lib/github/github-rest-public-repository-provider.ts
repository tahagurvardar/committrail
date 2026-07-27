import { PublicRepositoryProviderError } from "@/lib/github/errors";
import {
  mapRepositorySnapshot,
  readRateLimit,
} from "@/lib/github/map-github-response";
import type { PublicRepositoryProvider } from "@/lib/github/public-repository-provider";
import type {
  PublicRepositorySnapshot,
  RepositoryIdentifier,
} from "@/lib/github/types";

/**
 * GitHub REST implementation of the public repository provider.
 *
 * Server-only: this module is imported exclusively from Server Components and
 * never from client code. Requests are built strictly against the fixed
 * GITHUB_API_BASE_URL from an already-validated { owner, repo } — visitor
 * input is never fetched (SSRF boundary; see parse-repository-input.ts).
 *
 * Read-only by design: only GET requests, only public-data endpoints.
 */

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ERROR_RESPONSE_BYTES = 8 * 1024;

/** Mirrors the parser's rules as defense in depth inside the provider. */
const SAFE_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const SAFE_REPO = /^(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

interface GitHubJsonResponse {
  status: number;
  headers: Headers;
  body: unknown | null;
}

export interface GitHubProviderOptions {
  /** Optional server-only token; raises rate limits, never required. */
  token?: string;
  /** Injection point for tests — never a user-supplied value. */
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  now?: () => Date;
}

export class GitHubRestPublicRepositoryProvider implements PublicRepositoryProvider {
  private readonly token: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly now: () => Date;

  constructor(options: GitHubProviderOptions = {}) {
    this.token = options.token?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
  }

  async getRepositorySnapshot(
    repository: RepositoryIdentifier,
  ): Promise<PublicRepositorySnapshot> {
    if (
      !SAFE_OWNER.test(repository.owner) ||
      !SAFE_REPO.test(repository.repo)
    ) {
      throw new PublicRepositoryProviderError(
        "invalid-input",
        "That repository address is not valid.",
      );
    }

    const repoPath = `${GITHUB_API_BASE_URL}/repos/${encodeURIComponent(
      repository.owner,
    )}/${encodeURIComponent(repository.repo)}`;

    const metadataResponse = await this.requestJson(repoPath);
    const metadata = metadataResponse.body;
    const rateLimit = readRateLimit(metadataResponse.headers);

    // Two follow-up requests, bounded and in parallel — no fan-out beyond this.
    const [languagesResponse, readmeResponse] = await Promise.all([
      this.requestJson(`${repoPath}/languages`),
      this.requestJson(`${repoPath}/readme`, { allowNotFound: true }),
    ]);

    const languages = languagesResponse.body;
    const readme = readmeResponse.body;

    return mapRepositorySnapshot({
      metadata,
      languages,
      readme,
      fetchedAt: this.now().toISOString(),
      rateLimit,
    });
  }

  private async requestJson(
    url: string,
    options?: { allowNotFound?: boolean },
  ): Promise<GitHubJsonResponse> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "CommitTrail",
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 404 && options?.allowNotFound) {
        return {
          status: response.status,
          headers: response.headers,
          body: null,
        };
      }
      if (!response.ok) {
        const providerError = await this.errorForStatus(response);
        if (controller.signal.aborted) {
          throw timeoutError();
        }
        throw providerError;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          throw timeoutError();
        }
        throw new PublicRepositoryProviderError(
          "malformed-response",
          "GitHub returned a response that could not be read.",
        );
      }

      return {
        status: response.status,
        headers: response.headers,
        body,
      };
    } catch (error) {
      if (error instanceof PublicRepositoryProviderError) {
        throw error;
      }
      if (controller.signal.aborted || isAbortError(error)) {
        throw timeoutError();
      }
      throw new PublicRepositoryProviderError(
        "upstream-unavailable",
        "GitHub could not be reached. Please try again in a moment.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async errorForStatus(
    response: Response,
  ): Promise<PublicRepositoryProviderError> {
    const status = response.status;

    if (status === 404 || status === 451) {
      return new PublicRepositoryProviderError(
        "not-found",
        "Repository not found or not publicly accessible.",
        { status },
      );
    }

    if (status === 401) {
      return new PublicRepositoryProviderError(
        "auth-config",
        "The server’s optional GitHub credentials were rejected. This is a site configuration problem — you don’t need to provide anything.",
        { status },
      );
    }

    if (status === 403 || status === 429) {
      const rateLimit = readRateLimit(response.headers);
      const retryAfterSeconds = parseRetryAfter(
        response.headers.get("retry-after"),
        this.now(),
      );
      const errorMessage = await readBoundedErrorMessage(response);
      const rateLimited =
        rateLimit?.remaining === 0 ||
        retryAfterSeconds !== null ||
        status === 429 ||
        messageIndicatesRateLimit(errorMessage);
      if (rateLimited) {
        return new PublicRepositoryProviderError(
          "rate-limited",
          "GitHub temporarily rate-limited requests from this site.",
          {
            status,
            retryAfterSeconds,
            rateLimitResetAt:
              retryAfterSeconds === null && rateLimit?.remaining === 0
                ? rateLimit.resetAt
                : null,
          },
        );
      }
      // A plain 403 without rate-limit markers: not accessible to us.
      return new PublicRepositoryProviderError(
        "not-found",
        "Repository not found or not publicly accessible.",
        { status },
      );
    }

    if (status >= 500) {
      return new PublicRepositoryProviderError(
        "upstream-unavailable",
        "GitHub is currently unavailable. Please try again in a moment.",
        { status },
      );
    }

    return new PublicRepositoryProviderError(
      "unexpected",
      `GitHub returned an unexpected response (HTTP ${status}).`,
      { status },
    );
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function timeoutError(): PublicRepositoryProviderError {
  return new PublicRepositoryProviderError(
    "timeout",
    "GitHub did not respond in time. Please try again in a moment.",
  );
}

function parseRetryAfter(value: string | null, now: Date): number | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const seconds = Math.ceil((timestamp - now.getTime()) / 1000);
  return seconds >= 0 ? seconds : null;
}

function messageIndicatesRateLimit(message: string | null): boolean {
  return (
    message !== null &&
    /\brate[\s-]?limit(?:ed|ing)?\b|\bsecondary[\s-]+rate[\s-]+limit\b|\babuse(?:\s+detection)?\b|\bthrottl(?:e|ed|ing)\b/i.test(
      message,
    )
  );
}

async function readBoundedErrorMessage(
  response: Response,
): Promise<string | null> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength.trim())) {
    const size = Number(contentLength);
    if (!Number.isSafeInteger(size) || size > MAX_ERROR_RESPONSE_BYTES) {
      return null;
    }
  }
  if (response.body === null) {
    return null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_ERROR_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).message === "string"
    ) {
      const message = (parsed as Record<string, string>).message.trim();
      return message.length > 0 ? message : null;
    }
  } catch {
    // Marker-less, malformed, and oversized bodies are intentionally ignored.
  }
  return null;
}
