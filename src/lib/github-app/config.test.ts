import { afterEach, describe, expect, it } from "vitest";
import { getGitHubAppConfig } from "@/lib/github-app/config";

const names = [
  "GITHUB_APP_ID",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_PRIVATE_KEY",
  "BETTER_AUTH_URL",
] as const;

describe("GitHub App configuration", () => {
  afterEach(() => names.forEach((name) => delete process.env[name]));

  it("is lazy and unavailable when secrets are absent", () => {
    expect(getGitHubAppConfig()).toBeNull();
  });

  it("normalizes escaped PEM newlines without exposing values", () => {
    process.env.GITHUB_APP_ID = "123";
    process.env.GITHUB_APP_CLIENT_ID = "Iv1.test";
    process.env.GITHUB_APP_CLIENT_SECRET = "test-secret";
    process.env.GITHUB_APP_SLUG = "committrail-dev";
    process.env.GITHUB_APP_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nfixture\\n-----END PRIVATE KEY-----";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    const config = getGitHubAppConfig();
    expect(config?.privateKey).toContain("\nfixture\n");
    expect(JSON.stringify({ configured: config !== null })).not.toContain(
      "test-secret",
    );
  });

  it("rejects a user-controlled-looking slug", () => {
    process.env.GITHUB_APP_ID = "123";
    process.env.GITHUB_APP_CLIENT_ID = "client";
    process.env.GITHUB_APP_CLIENT_SECRET = "secret";
    process.env.GITHUB_APP_SLUG = "../other";
    process.env.GITHUB_APP_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    expect(getGitHubAppConfig()).toBeNull();
  });
});
