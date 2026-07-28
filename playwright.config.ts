import { defineConfig, devices } from "@playwright/test";

/**
 * Deterministic v1 release matrix. CI installs locked Chromium; local runs need
 * `npx playwright install chromium` once and a disposable test PostgreSQL URL.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    command: "node scripts/start-e2e.mjs",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_MODE: "full",
      E2E_FIXTURES: "1",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_URL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
      BETTER_AUTH_SECRET: "e2e-only-better-auth-secret-at-least-32-bytes",
      APP_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      GITHUB_WEBHOOK_SECRET: "e2e-only-deterministic-webhook-secret-32-bytes",
      PUBLIC_APP_URL: "https://committrail.example.test",
      DRAFT_PROVIDER: "disabled",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
