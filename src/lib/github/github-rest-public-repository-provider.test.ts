import { describe, expect, it, vi } from "vitest";

import {
  isProviderError,
  type PublicRepositoryProviderError,
} from "@/lib/github/errors";
import { GitHubRestPublicRepositoryProvider } from "@/lib/github/github-rest-public-repository-provider";

const FIXED_NOW = new Date("2026-07-27T12:00:00Z");
const IDENTIFIER = { owner: "acme", repo: "rocket" };

const README_MARKDOWN = [
  "# Rocket",
  "",
  "Launch tooling for fictional demos.",
  "",
  "[Read the docs](https://docs.example.com)",
  "<img src=x>",
].join("\n");

function repositoryFixture(): Record<string, unknown> {
  return {
    name: "rocket",
    full_name: "acme/rocket",
    private: false,
    owner: {
      login: "acme",
      avatar_url: "https://avatars.githubusercontent.com/u/9999?v=4",
    },
    html_url: "https://github.com/acme/rocket",
    description: "Launch tooling for fictional demos.",
    fork: false,
    archived: false,
    is_template: false,
    created_at: "2023-01-10T12:00:00Z",
    updated_at: "2026-07-01T08:30:00Z",
    pushed_at: "2026-06-28T19:45:00Z",
    homepage: "https://rocket.example.com",
    stargazers_count: 1234,
    forks_count: 56,
    open_issues_count: 7,
    subscribers_count: 21,
    license: { name: "MIT License", spdx_id: "MIT" },
    topics: ["tooling", "launch"],
    language: "TypeScript",
    default_branch: "main",
  };
}

function readmeFixture(): Record<string, unknown> {
  return {
    name: "README.md",
    path: "README.md",
    html_url: "https://github.com/acme/rocket/blob/main/README.md",
    encoding: "base64",
    content: Buffer.from(README_MARKDOWN, "utf8").toString("base64"),
    size: README_MARKDOWN.length,
  };
}

type Handler = () => Response;

function json(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Handler {
  return () =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "content-type": "application/json", ...init?.headers },
    });
}

interface RecordedCall {
  url: string;
  init: RequestInit;
}

function makeFetch(handlers: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  const impl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    for (const [suffix, handler] of Object.entries(handlers)) {
      if (url.endsWith(suffix)) {
        return handler();
      }
    }
    throw new Error(`Unexpected URL in test fetch: ${url}`);
  };
  return { impl, calls };
}

function happyHandlers(): Record<string, Handler> {
  return {
    "/repos/acme/rocket": json(repositoryFixture(), {
      headers: {
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "55",
        "x-ratelimit-reset": "1785600000",
      },
    }),
    "/repos/acme/rocket/languages": json({
      TypeScript: 7000,
      Rust: 2000,
      CSS: 1000,
    }),
    "/repos/acme/rocket/readme": json(readmeFixture()),
  };
}

type TestFetch = (url: string, init: RequestInit) => Promise<Response>;

function provider(
  fetchImpl: TestFetch,
  options?: { token?: string; timeoutMs?: number },
) {
  return new GitHubRestPublicRepositoryProvider({
    fetchImpl,
    now: () => FIXED_NOW,
    ...options,
  });
}

async function expectProviderError(
  promise: Promise<unknown>,
  code: string,
): Promise<PublicRepositoryProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(
      isProviderError(error),
      `expected provider error, got ${error}`,
    ).toBe(true);
    if (isProviderError(error)) {
      expect(error.code).toBe(code);
      return error;
    }
  }
  throw new Error(`expected promise to reject with ${code}`);
}

describe("GitHubRestPublicRepositoryProvider — success paths", () => {
  it("maps a full snapshot from the three public endpoints", async () => {
    const { impl, calls } = makeFetch(happyHandlers());
    const snapshot = await provider(impl).getRepositorySnapshot(IDENTIFIER);

    expect(snapshot.identity).toEqual({
      owner: "acme",
      name: "rocket",
      fullName: "acme/rocket",
      url: "https://github.com/acme/rocket",
    });
    expect(snapshot.defaultBranch).toBe("main");
    expect(snapshot.stars).toBe(1234);
    expect(snapshot.subscribers).toBe(21);
    expect(snapshot.license).toEqual({ name: "MIT License", spdxId: "MIT" });
    expect(snapshot.topics).toEqual(["tooling", "launch"]);
    expect(snapshot.homepage).toBe("https://rocket.example.com/");
    expect(snapshot.fetchedAt).toBe(FIXED_NOW.toISOString());
    expect(snapshot.rateLimit).toEqual({
      limit: 60,
      remaining: 55,
      resetAt: new Date(1785600000 * 1000).toISOString(),
    });

    // SSRF boundary: every request goes to the fixed GitHub API base.
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(
        call.url.startsWith("https://api.github.com/repos/acme/rocket"),
      ).toBe(true);
      expect(call.init.method).toBe("GET");
      expect(call.init.cache).toBe("no-store");
      expect(call.init).not.toHaveProperty("next");
    }
  });

  it("maps language bytes into sorted percentage shares", async () => {
    const { impl } = makeFetch(happyHandlers());
    const snapshot = await provider(impl).getRepositorySnapshot(IDENTIFIER);
    expect(snapshot.languages).toEqual([
      { name: "TypeScript", bytes: 7000, percent: 70 },
      { name: "Rust", bytes: 2000, percent: 20 },
      { name: "CSS", bytes: 1000, percent: 10 },
    ]);
  });

  it("decodes the README into a plain-text excerpt without markup", async () => {
    const { impl } = makeFetch(happyHandlers());
    const snapshot = await provider(impl).getRepositorySnapshot(IDENTIFIER);
    expect(snapshot.readme.present).toBe(true);
    expect(snapshot.readme.path).toBe("README.md");
    expect(snapshot.readme.htmlUrl).toBe(
      "https://github.com/acme/rocket/blob/main/README.md",
    );
    expect(snapshot.readme.excerpt).toBe(
      "Rocket\n\nLaunch tooling for fictional demos.\n\nRead the docs",
    );
    expect(snapshot.readme.excerpt).not.toContain("<img");
    expect(snapshot.readme.excerpt).not.toContain("](");
  });

  it("degrades safely when README base64 or UTF-8 is malformed", async () => {
    for (const content of ["%%%not-base64%%%", "/w=="]) {
      const handlers = happyHandlers();
      handlers["/repos/acme/rocket/readme"] = json({
        ...readmeFixture(),
        content,
      });
      const { impl } = makeFetch(handlers);
      const snapshot = await provider(impl).getRepositorySnapshot(IDENTIFIER);
      expect(snapshot.readme.present).toBe(true);
      expect(snapshot.readme.excerpt).toBeNull();
    }
  });

  it("bounds oversized README decoding and excerpt output", async () => {
    const handlers = happyHandlers();
    handlers["/repos/acme/rocket/readme"] = json({
      ...readmeFixture(),
      content: Buffer.from("A".repeat(70 * 1024), "utf8").toString("base64"),
    });
    const { impl } = makeFetch(handlers);
    const snapshot = await provider(impl).getRepositorySnapshot(IDENTIFIER);
    expect(snapshot.readme.excerpt?.length).toBeLessThanOrEqual(500);
    expect(snapshot.readme.truncated).toBe(true);
  });

  it("rejects non-canonical README links and unsafe homepage schemes", async () => {
    const handlers = happyHandlers();
    handlers["/repos/acme/rocket"] = json({
      ...repositoryFixture(),
      homepage: "javascript:alert(1)",
    });
    handlers["/repos/acme/rocket/readme"] = json({
      ...readmeFixture(),
      html_url: "https://evil.example/phishing",
    });
    const { impl } = makeFetch(handlers);
    const snapshot = await provider(impl).getRepositorySnapshot(IDENTIFIER);
    expect(snapshot.homepage).toBeNull();
    expect(snapshot.readme.htmlUrl).toBeNull();
  });

  it("treats a missing README (404) as a normal state, not an error", async () => {
    const handlers = happyHandlers();
    handlers["/repos/acme/rocket/readme"] = json(
      { message: "Not Found" },
      { status: 404 },
    );
    const { impl } = makeFetch(handlers);
    const snapshot = await provider(impl).getRepositorySnapshot(IDENTIFIER);
    expect(snapshot.readme).toEqual({
      present: false,
      path: null,
      htmlUrl: null,
      excerpt: null,
      truncated: false,
    });
  });

  it("does not fabricate an empty language distribution from a 404", async () => {
    const handlers = happyHandlers();
    handlers["/repos/acme/rocket/languages"] = json(
      { message: "Not Found" },
      { status: 404 },
    );
    const { impl } = makeFetch(handlers);
    await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "not-found",
    );
  });

  it("sends the documented headers without Authorization when no token is set", async () => {
    const { impl, calls } = makeFetch(happyHandlers());
    await provider(impl).getRepositorySnapshot(IDENTIFIER);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Accept).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2026-03-10");
    expect(headers["User-Agent"]).toBe("CommitTrail");
    expect(headers.Authorization).toBeUndefined();
  });

  it("sends a Bearer Authorization header only when a token is configured", async () => {
    const { impl, calls } = makeFetch(happyHandlers());
    await provider(impl, { token: "test-token-value" }).getRepositorySnapshot(
      IDENTIFIER,
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token-value");
  });
});

describe("snapshot dependency ordering", () => {
  it("does not request dependent endpoints when repository metadata fails", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("unavailable", { status: 500 }),
    );

    await expect(
      provider(fetchImpl).getRepositorySnapshot(IDENTIFIER),
    ).rejects.toMatchObject({ code: "upstream-unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("GitHubRestPublicRepositoryProvider — failure paths", () => {
  it("maps a repository 404 to not-found with honest wording", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json({ message: "Not Found" }, { status: 404 }),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "not-found",
    );
    expect(error.message).toBe(
      "Repository not found or not publicly accessible.",
    );
  });

  it("never renders a private repository, even if the API returns one", async () => {
    const handlers = happyHandlers();
    handlers["/repos/acme/rocket"] = json({
      ...repositoryFixture(),
      private: true,
    });
    const { impl } = makeFetch(handlers);
    await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "not-found",
    );
  });

  it("maps an exhausted 403 to rate-limited with the reset time", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json(
        { message: "API rate limit exceeded" },
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1785603600",
          },
        },
      ),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "rate-limited",
    );
    expect(
      (error as { rateLimitResetAt: string | null }).rateLimitResetAt,
    ).toBe(new Date(1785603600 * 1000).toISOString());
  });

  it("maps a secondary-limit 403 from its bounded JSON message", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json(
        {
          message:
            "You have exceeded a secondary rate limit. Please wait before retrying.",
        },
        { status: 403 },
      ),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "rate-limited",
    );
    expect(error.retryAfterSeconds).toBeNull();
    expect(error.rateLimitResetAt).toBeNull();
    expect(error.message).not.toContain("secondary rate limit");
  });

  it("maps a 403 with Retry-After to rate-limited and prefers that timing", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json(
        { message: "Please slow down" },
        {
          status: 403,
          headers: {
            "retry-after": "30",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1785603600",
          },
        },
      ),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "rate-limited",
    );
    expect(
      (error as { retryAfterSeconds: number | null }).retryAfterSeconds,
    ).toBe(30);
    expect(error.rateLimitResetAt).toBeNull();
  });

  it("supports an HTTP-date Retry-After value", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json(
        { message: "Please slow down" },
        {
          status: 403,
          headers: { "retry-after": "Mon, 27 Jul 2026 12:02:00 GMT" },
        },
      ),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "rate-limited",
    );
    expect(error.retryAfterSeconds).toBe(120);
  });

  it("maps every 429 to rate-limited without inventing timing", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json(
        { message: "Too Many Requests" },
        { status: 429 },
      ),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "rate-limited",
    );
    expect(error.retryAfterSeconds).toBeNull();
    expect(error.rateLimitResetAt).toBeNull();
  });

  it("maps a plain 403 without rate-limit markers to not-found", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json({ message: "Forbidden" }, { status: 403 }),
    });
    await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "not-found",
    );
  });

  it("ignores a malformed 403 error body instead of exposing it", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": () =>
        new Response("not-json: rate limit", { status: 403 }),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "not-found",
    );
    expect(error.message).not.toContain("not-json");
    expect(error.message).not.toContain("rate limit");
  });

  it("reads no more than the strict error-body cap", async () => {
    const rawBody = JSON.stringify({
      message: `secondary rate limit ${"x".repeat(9_000)}`,
    });
    const { impl } = makeFetch({
      "/repos/acme/rocket": () => new Response(rawBody, { status: 403 }),
    });
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "not-found",
    );
    expect(error.message).not.toContain("secondary");
    expect(error.message).not.toContain("x".repeat(100));
  });

  it("handles an absent 403 body as a marker-less access failure", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": () => new Response(null, { status: 403 }),
    });
    await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "not-found",
    );
  });

  it("maps a 401 from a configured token to auth-config and never leaks the token", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json(
        { message: "Bad credentials" },
        { status: 401 },
      ),
    });
    const error = await expectProviderError(
      provider(impl, { token: "super-secret-token" }).getRepositorySnapshot(
        IDENTIFIER,
      ),
      "auth-config",
    );
    expect(error.message).not.toContain("super-secret-token");
    expect(error.message.toLowerCase()).not.toContain("authorization");
    expect(error.message.toLowerCase()).toContain("configuration");
  });

  it("never exposes an upstream body or configured token in errors or logs", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "super-secret-token";
    const rawMessage = `secondary rate limit; ${secret}; upstream-only-detail`;
    const { impl } = makeFetch({
      "/repos/acme/rocket": json({ message: rawMessage }, { status: 403 }),
    });

    const error = await expectProviderError(
      provider(impl, { token: secret }).getRepositorySnapshot(IDENTIFIER),
      "rate-limited",
    );

    expect(error.message).not.toContain(secret);
    expect(error.message).not.toContain("upstream-only-detail");
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("maps a GitHub 500 to upstream-unavailable", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": json({ message: "boom" }, { status: 500 }),
    });
    await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "upstream-unavailable",
    );
  });

  it("maps an aborted request to timeout", async () => {
    const hangingFetch = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(
            Object.assign(new Error("This operation was aborted"), {
              name: "AbortError",
            }),
          );
        });
      });
    await expectProviderError(
      provider(hangingFetch, { timeoutMs: 20 }).getRepositorySnapshot(
        IDENTIFIER,
      ),
      "timeout",
    );
  });

  it("keeps response-body consumption inside the timeout", async () => {
    const hangingBodyFetch = async (
      _url: string,
      init: RequestInit,
    ): Promise<Response> =>
      new Response(
        new ReadableStream({
          start(controller) {
            init.signal?.addEventListener("abort", () => {
              controller.error(
                Object.assign(new Error("This operation was aborted"), {
                  name: "AbortError",
                }),
              );
            });
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );

    await expectProviderError(
      provider(hangingBodyFetch, { timeoutMs: 20 }).getRepositorySnapshot(
        IDENTIFIER,
      ),
      "timeout",
    );
  });

  it("maps a network failure to upstream-unavailable", async () => {
    const failingFetch = async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    };
    await expectProviderError(
      provider(failingFetch).getRepositorySnapshot(IDENTIFIER),
      "upstream-unavailable",
    );
  });

  it("maps unparseable JSON to malformed-response", async () => {
    const { impl } = makeFetch({
      "/repos/acme/rocket": () =>
        new Response("this is not json{", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "malformed-response",
    );
  });

  it("rejects responses missing required fields instead of inventing values", async () => {
    const incomplete = repositoryFixture();
    delete incomplete.default_branch;
    const handlers = happyHandlers();
    handlers["/repos/acme/rocket"] = json(incomplete);
    const { impl } = makeFetch(handlers);
    const error = await expectProviderError(
      provider(impl).getRepositorySnapshot(IDENTIFIER),
      "malformed-response",
    );
    expect(error.message).toContain("default_branch");
  });

  it("rejects identifiers outside the strict grammar before any request", async () => {
    const { impl, calls } = makeFetch(happyHandlers());
    for (const identifier of [
      { owner: "../evil", repo: "x" },
      { owner: "github.com", repo: "owner/repo" },
      { owner: "127.0.0.1", repo: "admin" },
      { owner: "owner", repo: "%2e%2e" },
    ]) {
      await expectProviderError(
        provider(impl).getRepositorySnapshot(identifier),
        "invalid-input",
      );
    }
    expect(calls).toHaveLength(0);
  });
});
