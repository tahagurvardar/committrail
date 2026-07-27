import { describe, expect, it } from "vitest";

import {
  mapCommitResponse,
  mapIssueResponse,
  mapPullRequestResponse,
  mapReleaseResponse,
  mapWorkflowRunResponse,
} from "@/lib/github/map-github-activity-response";

const REPOSITORY = { owner: "acme", repo: "rocket" };
const SHA = "a".repeat(40);

function commit(overrides: Record<string, unknown> = {}) {
  return {
    sha: SHA,
    html_url: `https://github.com/acme/rocket/commit/${SHA}`,
    author: { login: "octocat" },
    commit: {
      message: "Ship activity evidence\nbody not retained",
      author: {
        name: "Octo Cat",
        email: "private@example.com",
        date: "2026-07-27T11:00:00Z",
      },
      verification: { verified: true },
    },
    ...overrides,
  };
}

function pull(overrides: Record<string, unknown> = {}) {
  return {
    id: 201,
    number: 12,
    title: "Add evidence",
    state: "open",
    draft: false,
    user: { login: "octocat" },
    created_at: "2026-07-20T10:00:00Z",
    updated_at: "2026-07-27T10:00:00Z",
    closed_at: null,
    merged_at: null,
    html_url: "https://github.com/acme/rocket/pull/12",
    base: { ref: "main" },
    head: { ref: "feat/evidence" },
    ...overrides,
  };
}

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: 301,
    number: 18,
    title: "Document limits",
    state: "open",
    state_reason: "reopened",
    user: { login: "octocat" },
    created_at: "2026-07-21T10:00:00Z",
    updated_at: "2026-07-27T09:00:00Z",
    closed_at: null,
    comments: 2,
    labels: [{ name: "docs", color: "0E8A16" }],
    html_url: "https://github.com/acme/rocket/issues/18",
    ...overrides,
  };
}

function release(overrides: Record<string, unknown> = {}) {
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
    body: "<h1>not retained</h1>",
    html_url: "https://github.com/acme/rocket/releases/tag/v1.2.0",
    ...overrides,
  };
}

function workflow(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

describe("commit activity mapping", () => {
  it("uses the full SHA for stable evidence identity and only the first message line", () => {
    const result = mapCommitResponse([commit()], REPOSITORY);
    expect(result.discardedRecordCount).toBe(0);
    expect(result.items[0]).toMatchObject({
      evidenceId: `github:commit:${SHA}`,
      sourceIdentifier: SHA,
      shortSha: "aaaaaaa",
      title: "Ship activity evidence",
      authorLogin: "octocat",
      authorDisplayName: null,
      verification: "verified",
      confidence: "fact",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private@example\.com|body not retained/,
    );
  });

  it("falls back to a bounded display name for a null GitHub author", () => {
    const result = mapCommitResponse(
      [
        commit({
          author: null,
          commit: {
            message: "Safe\u0000 message\twith spacing",
            author: {
              name: `Fallback ${"x".repeat(200)}`,
              email: "never@example.com",
              date: "2026-07-27T11:00:00Z",
            },
          },
        }),
      ],
      REPOSITORY,
    );
    expect(result.items[0].title).toBe("Safe message with spacing");
    expect(result.items[0].authorLogin).toBeNull();
    expect(result.items[0].authorDisplayName).toHaveLength(100);
    expect(result.items[0].authorDisplayName?.endsWith("…")).toBe(true);
  });

  it("bounds long first-line messages", () => {
    const result = mapCommitResponse(
      [
        commit({
          commit: {
            message: `${"x".repeat(250)}\nignored`,
            author: { name: "A", date: "2026-07-27T11:00:00Z" },
          },
        }),
      ],
      REPOSITORY,
    );
    expect(result.items[0].title).toHaveLength(180);
    expect(result.items[0].title.endsWith("…")).toBe(true);
  });

  it.each([
    ["invalid SHA", { sha: "abc" }],
    ["unsafe URL", { html_url: "javascript:alert(1)" }],
    [
      "wrong repository URL",
      { html_url: `https://github.com/evil/repo/commit/${SHA}` },
    ],
  ])("omits %s and records the discard", (_label, overrides) => {
    const result = mapCommitResponse([commit(overrides)], REPOSITORY);
    expect(result).toEqual({ items: [], discardedRecordCount: 1 });
  });
});

describe("pull request activity mapping", () => {
  it.each([
    ["open", false, null],
    ["closed", false, null],
    ["open", true, null],
    ["closed", false, "2026-07-27T10:00:00Z"],
  ] as const)(
    "maps %s PR records, drafts, and reliable merged timestamps",
    (state, draft, mergedAt) => {
      const result = mapPullRequestResponse(
        [
          pull({
            state,
            draft,
            closed_at: state === "closed" ? "2026-07-27T10:00:00Z" : null,
            merged_at: mergedAt,
          }),
        ],
        REPOSITORY,
      );
      expect(result.items[0]).toMatchObject({
        evidenceId: "github:pull-request:201",
        state,
        draft,
        mergedAt: mergedAt === null ? null : new Date(mergedAt).toISOString(),
      });
    },
  );

  it("accepts a nullable user and bounds untrusted title text", () => {
    const result = mapPullRequestResponse(
      [pull({ user: null, title: `PR ${"x".repeat(250)}` })],
      REPOSITORY,
    );
    expect(result.items[0].authorLogin).toBeNull();
    expect(result.items[0].title).toHaveLength(180);
  });

  it("discards a malformed PR without inventing fallback fields", () => {
    expect(mapPullRequestResponse([pull({ id: "201" })], REPOSITORY)).toEqual({
      items: [],
      discardedRecordCount: 1,
    });
  });
});

describe("issue activity mapping", () => {
  it("includes standalone issues and excludes every pull_request marker", () => {
    const result = mapIssueResponse(
      [issue(), issue({ id: 302, pull_request: {} })],
      REPOSITORY,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      evidenceId: "github:issue:301",
      stateReason: "reopened",
      commentCount: 2,
    });
    expect(result.discardedRecordCount).toBe(0);
  });

  it("maps bounded labels and nulls an invalid label color", () => {
    const result = mapIssueResponse(
      [
        issue({
          title: `Issue ${"x".repeat(250)}`,
          labels: [
            { name: "docs", color: "0E8A16" },
            { name: "unsafe", color: "url(javascript:1)" },
          ],
        }),
      ],
      REPOSITORY,
    );
    expect(result.items[0].title).toHaveLength(180);
    expect(result.items[0].labels).toEqual([
      { name: "docs", color: "0e8a16" },
      { name: "unsafe", color: null },
    ]);
  });

  it("discards malformed issue records", () => {
    expect(mapIssueResponse([issue({ comments: -1 })], REPOSITORY)).toEqual({
      items: [],
      discardedRecordCount: 1,
    });
  });
});

describe("release activity mapping", () => {
  it("maps a published release without retaining its body or asset payload", () => {
    const result = mapReleaseResponse([release()], REPOSITORY);
    expect(result.items[0]).toMatchObject({
      evidenceId: "github:release:401",
      tagName: "v1.2.0",
      assetCount: 1,
      prerelease: false,
      immutable: true,
    });
    expect(JSON.stringify(result)).not.toContain("not retained");
    expect(JSON.stringify(result)).not.toContain('"assets"');
  });

  it("maps prereleases and nullable authors while bounding name and tag", () => {
    const result = mapReleaseResponse(
      [
        release({
          prerelease: true,
          author: null,
          name: `Release ${"n".repeat(250)}`,
          tag_name: `v${"1".repeat(150)}`,
        }),
      ],
      REPOSITORY,
    );
    expect(result.items[0].prerelease).toBe(true);
    expect(result.items[0].authorLogin).toBeNull();
    expect(result.items[0].releaseName).toHaveLength(180);
    expect(result.items[0].tagName).toHaveLength(120);
  });

  it("excludes drafts from public records without calling them malformed", () => {
    expect(mapReleaseResponse([release({ draft: true })], REPOSITORY)).toEqual({
      items: [],
      discardedRecordCount: 0,
    });
  });

  it("discards malformed releases", () => {
    expect(mapReleaseResponse([release({ assets: null })], REPOSITORY)).toEqual(
      {
        items: [],
        discardedRecordCount: 1,
      },
    );
  });
});

describe("workflow-run activity mapping", () => {
  it.each([
    ["completed", "success"],
    ["completed", "failure"],
    ["completed", "cancelled"],
    ["completed", "skipped"],
    ["completed", "neutral"],
    ["queued", null],
    ["in_progress", null],
  ] as const)("maps %s / %s workflow outcomes", (status, conclusion) => {
    const result = mapWorkflowRunResponse(
      {
        total_count: 1,
        workflow_runs: [workflow({ status, conclusion })],
      },
      REPOSITORY,
    );
    expect(result.items[0]).toMatchObject({
      evidenceId: "github:workflow-run:501",
      status,
      conclusion,
    });
  });

  it("bounds the workflow name and omits malformed runs", () => {
    const result = mapWorkflowRunResponse(
      {
        total_count: 2,
        workflow_runs: [
          workflow({ name: `CI ${"x".repeat(200)}` }),
          workflow({ head_sha: "bad" }),
        ],
      },
      REPOSITORY,
    );
    expect(result.items[0].workflowName).toHaveLength(160);
    expect(result.discardedRecordCount).toBe(1);
  });

  it("rejects an invalid wrapper as a whole-response validation failure", () => {
    expect(() =>
      mapWorkflowRunResponse({ workflow_runs: null }, REPOSITORY),
    ).toThrowError(/malformed workflow runs response/i);
  });
});

describe("whole-response validation", () => {
  it.each([
    ["commits", () => mapCommitResponse({}, REPOSITORY)],
    ["pull requests", () => mapPullRequestResponse({}, REPOSITORY)],
    ["issues", () => mapIssueResponse({}, REPOSITORY)],
    ["releases", () => mapReleaseResponse({}, REPOSITORY)],
  ])("rejects a malformed %s top-level shape", (_label, map) => {
    expect(map).toThrowError(/malformed/i);
  });
});
