import { getAppMode, assertTestFixturesSafe } from "./app-mode";

export type ConfigurationMode =
  "public-demo" | "local-full" | "production-full" | "test";

export type ConfigurationCheck = {
  mode: ConfigurationMode;
  valid: boolean;
  configured: {
    database: boolean;
    authentication: boolean;
    githubApp: boolean;
    webhook: boolean;
    drafting: boolean;
  };
  errors: string[];
};

const GITHUB_APP_KEYS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_PRIVATE_KEY",
] as const;

export function validateConfiguration(
  mode: ConfigurationMode,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ConfigurationCheck {
  const errors: string[] = [];
  const configured = {
    database: present(env.DATABASE_URL),
    authentication:
      present(env.BETTER_AUTH_URL) && validSecret(env.BETTER_AUTH_SECRET),
    githubApp: GITHUB_APP_KEYS.every((key) => present(env[key])),
    webhook: validSecret(env.GITHUB_WEBHOOK_SECRET),
    drafting: (env.DRAFT_PROVIDER ?? "disabled") !== "disabled",
  };

  try {
    assertTestFixturesSafe(env);
    const appMode = getAppMode(env);
    if (mode === "public-demo" && appMode !== "public-demo")
      errors.push("APP_MODE must be public-demo.");
    if (
      (mode === "local-full" || mode === "production-full") &&
      appMode !== "full"
    )
      errors.push("APP_MODE must be full.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "APP_MODE_INVALID");
  }

  if (mode !== "public-demo") {
    if (!configured.database)
      errors.push("Database configuration is required.");
    if (!configured.authentication)
      errors.push("Authentication configuration is incomplete.");
    if (!validEncryptionKey(env.APP_ENCRYPTION_KEY))
      errors.push("Application encryption configuration is invalid.");
  }

  if (mode === "production-full") {
    if (!isPublicHttpsOrigin(env.BETTER_AUTH_URL))
      errors.push("BETTER_AUTH_URL must be a public HTTPS origin.");
    if (!isPublicHttpsOrigin(env.PUBLIC_APP_URL))
      errors.push("PUBLIC_APP_URL must be a public HTTPS origin.");
    if (env.DRAFT_PROVIDER_BASE_URL?.startsWith("http://"))
      errors.push("Loopback or plaintext drafting URLs are not allowed.");
  }

  if (mode === "test") {
    if (
      !env.TEST_DATABASE_URL ||
      !present(env.TEST_DATABASE_URL) ||
      !testDatabase(env.TEST_DATABASE_URL)
    )
      errors.push("TEST_DATABASE_URL must clearly identify a test database.");
    if (env.E2E_FIXTURES !== "1")
      errors.push("E2E_FIXTURES must be explicitly enabled.");
  }

  const githubConfiguredCount = GITHUB_APP_KEYS.filter((key) =>
    present(env[key]),
  ).length;
  if (
    githubConfiguredCount > 0 &&
    githubConfiguredCount < GITHUB_APP_KEYS.length
  )
    errors.push("GitHub App configuration is incomplete.");

  return { mode, valid: errors.length === 0, configured, errors };
}

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function validSecret(value: string | undefined): boolean {
  return (value?.trim().length ?? 0) >= 32;
}

function validEncryptionKey(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

function isPublicHttpsOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "::1"
    );
  } catch {
    return false;
  }
}

function testDatabase(value: string): boolean {
  try {
    const url = new URL(value);
    return /test/i.test(
      `${url.pathname}${url.searchParams.get("schema") ?? ""}`,
    );
  } catch {
    return false;
  }
}
