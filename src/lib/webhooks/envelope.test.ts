import { describe, expect, it } from "vitest";
import {
  parseMinimalWebhookEnvelope,
  routeWebhookEnvelope,
} from "@/lib/webhooks/envelope";

function envelope(event: string, action?: string, extra = {}) {
  return parseMinimalWebhookEnvelope(event, {
    action,
    installation: { id: 10, account: { id: 20 } },
    repository: {
      id: 30,
      name: "repo",
      owner: { login: "owner" },
    },
    ...extra,
  });
}

const tracked = {
  trackedRepository: true,
  defaultBranch: "main",
  verifiedInstallation: true,
};

describe("minimal webhook routing", () => {
  it("acknowledges ping without a job", () => {
    expect(routeWebhookEnvelope(envelope("ping"), tracked)).toEqual({
      type: "ignored",
      reason: "PING_ACKNOWLEDGED",
    });
  });

  it("queues a default-branch push with only routing fields", () => {
    const result = routeWebhookEnvelope(
      envelope("push", undefined, {
        ref: "refs/heads/main",
        before: "a",
        after: "b",
        commits: [{ message: "must not persist", author: { email: "x@y" } }],
      }),
      tracked,
    );
    expect(result).toMatchObject({ type: "job", job: { kind: "COMMITS" } });
    expect(JSON.stringify(result)).not.toContain("must not persist");
    expect(JSON.stringify(result)).not.toContain("x@y");
  });

  it("ignores a non-default-branch push", () => {
    expect(
      routeWebhookEnvelope(
        envelope("push", undefined, { ref: "refs/heads/feature" }),
        tracked,
      ),
    ).toMatchObject({ type: "ignored", reason: "NON_DEFAULT_BRANCH" });
  });

  it.each([
    ["pull_request", "opened", "PULL_REQUESTS"],
    ["pull_request", "synchronize", "PULL_REQUESTS"],
    ["pull_request", "closed", "PULL_REQUESTS"],
    ["issues", "opened", "ISSUES"],
    ["issues", "transferred", "ISSUES"],
    ["release", "published", "RELEASES"],
    ["release", "deleted", "RELEASES"],
    ["workflow_run", "requested", "WORKFLOW_RUNS"],
    ["workflow_run", "completed", "WORKFLOW_RUNS"],
    ["repository", "renamed", "REPOSITORY_METADATA"],
    ["repository", "transferred", "REPOSITORY_METADATA"],
  ])("maps %s.%s to %s", (event, action, kind) => {
    expect(
      routeWebhookEnvelope(envelope(event, action), tracked),
    ).toMatchObject({ type: "job", job: { kind } });
  });

  it("rejects issue payloads carrying a pull request marker", () => {
    expect(
      routeWebhookEnvelope(
        envelope("issues", "opened", { issue: { id: 1, pull_request: {} } }),
        tracked,
      ),
    ).toEqual({ type: "ignored", reason: "ISSUE_IS_PULL_REQUEST" });
  });

  it.each([
    ["suspend", "INSTALLATION_STATE"],
    ["unsuspend", "INSTALLATION_STATE"],
    ["deleted", "INSTALLATION_STATE"],
    ["new_permissions_accepted", "INSTALLATION_STATE"],
  ])("maps installation.%s", (action, kind) => {
    expect(
      routeWebhookEnvelope(envelope("installation", action), tracked),
    ).toMatchObject({ type: "job", job: { kind } });
  });

  it.each(["added", "removed"])(
    "maps installation_repositories.%s with bounded IDs",
    (action) => {
      const result = routeWebhookEnvelope(
        envelope("installation_repositories", action, {
          repositories_added: [{ id: 31 }],
          repositories_removed: [{ id: 32 }],
        }),
        tracked,
      );
      expect(result).toMatchObject({
        type: "job",
        job: { kind: "INSTALLATION_REPOSITORIES" },
      });
    },
  );

  it("ignores unsupported events and actions", () => {
    expect(routeWebhookEnvelope(envelope("star", "created"), tracked)).toEqual({
      type: "ignored",
      reason: "UNSUPPORTED_EVENT",
    });
    expect(
      routeWebhookEnvelope(envelope("release", "unpublished"), tracked),
    ).toEqual({ type: "ignored", reason: "UNSUPPORTED_ACTION" });
  });

  it("ignores untracked repositories", () => {
    expect(
      routeWebhookEnvelope(envelope("pull_request", "opened"), {
        ...tracked,
        trackedRepository: false,
      }),
    ).toEqual({ type: "ignored", reason: "UNTRACKED_REPOSITORY" });
  });

  it("rejects installation/workspace mismatches before repository routing", () => {
    expect(
      routeWebhookEnvelope(envelope("pull_request", "opened"), {
        ...tracked,
        verifiedInstallation: false,
      }),
    ).toEqual({ type: "ignored", reason: "INSTALLATION_MISMATCH" });
  });
});
