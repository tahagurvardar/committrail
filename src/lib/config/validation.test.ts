import { describe, expect, it } from "vitest";
import { validateConfiguration } from "./validation";
import { assertTestFixturesSafe, getAppMode } from "./app-mode";

const full = {
  APP_MODE: "full",
  DATABASE_URL: "postgresql://local.test/committrail",
  TEST_DATABASE_URL: "postgresql://local.test/committrail_test",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a".repeat(32),
  APP_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

describe("release configuration validation", () => {
  it("accepts a database-free public demo", () => {
    expect(
      validateConfiguration("public-demo", { APP_MODE: "public-demo" }),
    ).toMatchObject({ valid: true, configured: { database: false } });
  });

  it("accepts complete local and test modes", () => {
    expect(validateConfiguration("local-full", full).valid).toBe(true);
    expect(
      validateConfiguration("test", { ...full, E2E_FIXTURES: "1" }).valid,
    ).toBe(true);
  });

  it("rejects incomplete production configuration without exposing values", () => {
    const result = validateConfiguration("production-full", full);
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).not.toContain(full.DATABASE_URL);
  });

  it("fails closed for invalid modes and production fixtures", () => {
    expect(() => getAppMode({ APP_MODE: "preview" })).toThrow(
      "APP_MODE_INVALID",
    );
    expect(() =>
      assertTestFixturesSafe({
        NODE_ENV: "production",
        E2E_FIXTURES: "1",
      }),
    ).toThrow("TEST_FIXTURES_FORBIDDEN_IN_PRODUCTION");
  });
});
