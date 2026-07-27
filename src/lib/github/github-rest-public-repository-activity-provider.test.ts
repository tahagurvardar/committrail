import { describe, expect, it, vi } from "vitest";

import { isProviderError } from "@/lib/github/errors";
import { GitHubRestPublicRepositoryActivityProvider } from "@/lib/github/github-rest-public-repository-activity-provider";

const IDENTIFIER = { owner: "acme", repo: "rocket" };
const NOW = new Date("2026-07-27T12:00:00Z");
const SHA = "a".repeat(40);

function commitFixture() {
  return {
    sha: SHA,
    html_url: `https://github.com/acme/rocket/commit/${SHA}`,
    author: { login: "octocat", email: "never-retained@example.com" },
    commit: {
      message: "Bounded activity\n\nPrivate-looking body",
      author: {
        name: "Octo Cat",
        email: "never-retained@example.com",
        date: "2026-07-27T11:00:00Z",
      },
      verification: { verified: true },
    },
  };
}

function pullFixture() {
  return {
    id: 201,
    number: 12,
    title: "Add evidence records",
    state: "closed",
    draft: false,
    user: { login: "octocat" },
    created_at: "2026-07-20T10:00:00Z",
    updated_at: "2026-07-27T10:00:00Z",
    closed_at: "2026-07-27T10:00:00Z",
    merged_at: "2026-07-27T10:00:00Z",
    html_url: "https://github.com/acme/rocket/pull/12",
    base: { ref: "main" },
    head: { ref: "feat/evidence" },
  };
}

function issueFixture() {
  return {
    id: 301,
    number: 18,
    title: "Document sampling limits",
    state: "open",
    state_reason: "reopened",
    user: null,
    created_at: "2026-07-21T10:00:00Z",
    updated_at: "2026-07-27T09:00:00Z",
    closed_at: null,
    comments: 2,
    labels: [{ name: "docs", color: "0e8a16" }],
    html_url: "https://github.com/acme/rocket/issues/18",
  };
}

function releaseFixture() {
  return {
    id: 401,
    tag_name: "v1.2.0",
    name: "Evidence release",
    draft: false,
    prerelease: false,
    immutable: true,
    created_at: "2026-07-25T08:00:00Z",
    published_at: "2026-07-25T09:00:00Z",
    author: { login: "octocat" },
    assets: [{ id: 1 }],
    body: "<script>not retained</script>",
    html_url: "https://github.com/acme/rocket/releases/tag/v1.2.0",
  };
}

function workflowFixture() {
  return {
    id: 501,
    name: "CI",
    run_number: 77,
    event: "push",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: SHA,
    created_at: "2026-07-27T08:00:00Z",
    updated_at: "2026-07-27T08:05:00Z",
    run_started_at: "2026-07-27T08:01:00Z",
    html_url: "https://github.com/acme/rocket/actions/runs/501",
  };
}

function responseFor(pathname: string): unknown {
  if (pathname.endsWith("/commits")) return [commitFixture()];
  if (pathname.endsWith("/pulls")) return [pullFixture()];
  if (pathname.endsWith("/issues")) return [issueFixture()];
  if (pathname.endsWith("/releases")) return [releaseFixture()];
  if (pathname.endsWith("/actions/runs")) {
    return { total_count: 1, workflow_runs: [workflowFixture()] };
  }
  throw new Error(`Unexpected path ${pathname}`);
}

function provider(
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
) {
  return new GitHubRestPublicRepositoryActivityProvider({
    fetchImpl,
    now: () => NOW,
    timeoutMs: 25,
  });
}

describe("GitHubRestPublicRepositoryActivityProvider", () => {
  it("constructs exactly the five allowed page-one endpoints and required parameters", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      calls.push({ url: parsed, init });
      return new Response(JSON.stringify(responseFor(parsed.pathname)), {
        headers: {
          "content-type": "application/json",
          link: `<https://api.github.com${parsed.pathname}?page=2>; rel="next"`,
        },
      });
    });

    const activity = await provider(fetchImpl).getRepositoryActivity(
      IDENTIFIER,
      { defaultBranch: "main" },
    );

    expect(calls).toHaveLength(5);
    expect(calls.map((call) => call.url.pathname).sort()).toEqual(
      [
        "/repos/acme/rocket/actions/runs",
        "/repos/acme/rocket/commits",
        "/repos/acme/rocket/issues",
        "/repos/acme/rocket/pulls",
        "/repos/acme/rocket/releases",
      ].sort(),
    );
    const commits = calls.find((call) =>
      call.url.pathname.endsWith("/commits"),
    )!.url;
    expect(Object.fromEntries(commits.searchParams)).toEqual({
      sha: "main",
      per_page: "20",
      page: "1",
    });
    for (const name of ["pulls", "issues"]) {
      const url = calls.find((call) =>
        call.url.pathname.endsWith(`/${name}`),
      )!.url;
      expect(Object.fromEntries(url.searchParams)).toEqual({
        state: "all",
        sort: "updated",
        direction: "desc",
        per_page: "20",
        page: "1",
      });
    }
    expect(
      Object.fromEntries(
        calls.find((call) => call.url.pathname.endsWith("/releases"))!.url
          .searchParams,
      ),
    ).toEqual({ per_page: "10", page: "1" });
    expect(
      Object.fromEntries(
        calls.find((call) => call.url.pathname.endsWith("/actions/runs"))!.url
          .searchParams,
      ),
    ).toEqual({ per_page: "20", page: "1" });
    expect(activity.commits.status).toBe("available");
    expect(
      activity.commits.status === "available" &&
        activity.commits.pagination.hasMore,
    ).toBe(true);
  });

  it("uses GET, fixed headers, no-store, and conditional server token authorization", async () => {
    for (const token of [undefined, "server-token"]) {
      const inits: RequestInit[] = [];
      const fetchImpl = async (url: string, init: RequestInit) => {
        inits.push(init);
        return new Response(
          JSON.stringify(responseFor(new URL(url).pathname)),
          { headers: { "content-type": "application/json" } },
        );
      };
      const instance = new GitHubRestPublicRepositoryActivityProvider({
        fetchImpl,
        token,
        now: () => NOW,
      });
      await instance.getRepositoryActivity(IDENTIFIER, {
        defaultBranch: "main",
      });
      expect(inits).toHaveLength(5);
      for (const init of inits) {
        expect(init.method).toBe("GET");
        expect(init.cache).toBe("no-store");
        const headers = init.headers as Record<string, string>;
        expect(headers.Accept).toBe("application/vnd.github+json");
        expect(headers["X-GitHub-Api-Version"]).toBe("2026-03-10");
        expect(headers["User-Agent"]).toBe("CommitTrail");
        expect(headers.Authorization).toBe(
          token ? `Bearer ${token}` : undefined,
        );
      }
    }
  });

  it("never exceeds two simultaneous activity requests", async () => {
    let active = 0;
    let maximumActive = 0;
    const fetchImpl = async (url: string) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response(JSON.stringify(responseFor(new URL(url).pathname)), {
        headers: { "content-type": "application/json" },
      });
    };

    await provider(fetchImpl).getRepositoryActivity(IDENTIFIER, {
      defaultBranch: "main",
    });
    expect(maximumActive).toBe(2);
  });

  it("does not make a second-page request or retry when Link advertises more", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      return new Response(JSON.stringify(responseFor(parsed.pathname)), {
        headers: {
          "content-type": "application/json",
          link: `<https://api.github.com${parsed.pathname}?page=2>; rel="next"`,
        },
      });
    });

    await provider(fetchImpl).getRepositoryActivity(IDENTIFIER, {
      defaultBranch: "main",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(
      fetchImpl.mock.calls.every(
        ([url]) => new URL(url).searchParams.get("page") === "1",
      ),
    ).toBe(true);
  });

  it("caps records at the configured sample limit even if upstream over-returns", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const body = path.endsWith("/commits")
        ? Array.from({ length: 25 }, (_, index) => {
            const sha = index.toString(16).padStart(40, "0");
            return commitFixtureWithSha(sha);
          })
        : responseFor(path);
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    });
    const activity = await provider(fetchImpl).getRepositoryActivity(
      IDENTIFIER,
      { defaultBranch: "main" },
    );
    expect(activity.commits).toMatchObject({
      status: "available",
      pagination: { returnedCount: 20, sampleLimit: 20 },
    });
    if (activity.commits.status === "available") {
      expect(activity.commits.items).toHaveLength(20);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("rejects an invalid repository before any submitted value reaches fetch", async () => {
    const fetchImpl = vi.fn();
    await expect(
      provider(fetchImpl).getRepositoryActivity(
        { owner: "https:", repo: "evil.example" },
        { defaultBranch: "main" },
      ),
    ).rejects.toMatchObject({ code: "invalid-input" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("isolates endpoint failures while preserving successful sections", async () => {
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/commits")) {
        return new Response("down", { status: 500 });
      }
      if (path.endsWith("/pulls")) {
        return new Response(
          JSON.stringify({ message: "rate limit exceeded" }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "60",
            },
          },
        );
      }
      if (path.endsWith("/releases")) {
        return new Response(JSON.stringify({ not: "an array" }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (path.endsWith("/actions/runs")) {
        return new Response(
          JSON.stringify({ total_count: 0, workflow_runs: [] }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(responseFor(path)), {
        headers: { "content-type": "application/json" },
      });
    };

    const activity = await provider(fetchImpl).getRepositoryActivity(
      IDENTIFIER,
      { defaultBranch: "main" },
    );
    expect(activity.commits).toMatchObject({
      status: "unavailable",
      reason: "upstream-unavailable",
    });
    expect(activity.pullRequests).toEqual({
      status: "unavailable",
      reason: "rate-limited",
      retryAt: "2026-07-27T12:01:00.000Z",
    });
    expect(activity.issues.status).toBe("available");
    expect(activity.releases).toMatchObject({
      status: "unavailable",
      reason: "malformed-response",
    });
    expect(activity.workflowRuns).toMatchObject({
      status: "available",
      items: [],
    });
  });

  it("normalizes a bounded timeout as a local unavailable section", async () => {
    const fetchImpl = async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/issues")) {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      return new Response(JSON.stringify(responseFor(path)), {
        headers: { "content-type": "application/json" },
      });
    };
    const activity = await provider(fetchImpl).getRepositoryActivity(
      IDENTIFIER,
      { defaultBranch: "main" },
    );
    expect(activity.issues).toEqual({
      status: "unavailable",
      reason: "timeout",
      retryAt: null,
    });
  });

  it("bounds successful upstream response bodies before parsing", async () => {
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/commits")) {
        return new Response("[]", {
          headers: {
            "content-type": "application/json",
            "content-length": String(3 * 1024 * 1024),
          },
        });
      }
      return new Response(JSON.stringify(responseFor(path)), {
        headers: { "content-type": "application/json" },
      });
    };
    const activity = await provider(fetchImpl).getRepositoryActivity(
      IDENTIFIER,
      { defaultBranch: "main" },
    );
    expect(activity.commits).toEqual({
      status: "unavailable",
      reason: "malformed-response",
      retryAt: null,
    });
  });

  it("keeps token configuration failures as full provider errors without leaking the token", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ message: "Bad credentials server-token" }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      );
    const instance = new GitHubRestPublicRepositoryActivityProvider({
      token: "server-token",
      fetchImpl,
      now: () => NOW,
    });
    try {
      await instance.getRepositoryActivity(IDENTIFIER, {
        defaultBranch: "main",
      });
      throw new Error("expected rejection");
    } catch (error) {
      expect(isProviderError(error)).toBe(true);
      if (isProviderError(error)) {
        expect(error.code).toBe("auth-config");
        expect(error.message).not.toContain("server-token");
      }
    }
  });

  it("treats an endpoint 404 as local not-supported after snapshot context exists", async () => {
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/actions/runs")) {
        return new Response("not found", { status: 404 });
      }
      return new Response(JSON.stringify(responseFor(path)), {
        headers: { "content-type": "application/json" },
      });
    };
    const activity = await provider(fetchImpl).getRepositoryActivity(
      IDENTIFIER,
      { defaultBranch: "main" },
    );
    expect(activity.workflowRuns).toEqual({
      status: "unavailable",
      reason: "not-supported",
      retryAt: null,
    });
  });
});

function commitFixtureWithSha(sha: string) {
  return {
    ...commitFixture(),
    sha,
    html_url: `https://github.com/acme/rocket/commit/${sha}`,
  };
}
