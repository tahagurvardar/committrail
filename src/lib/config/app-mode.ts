export const APP_MODES = ["full", "public-demo"] as const;
export type AppMode = (typeof APP_MODES)[number];

export function getAppMode(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AppMode {
  const value = (env.APP_MODE ?? "full").trim().toLowerCase();
  if (value === "full" || value === "public-demo") return value;
  throw new Error("APP_MODE_INVALID");
}

export function assertTestFixturesSafe(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (env.NODE_ENV === "production" && env.E2E_FIXTURES === "1")
    throw new Error("TEST_FIXTURES_FORBIDDEN_IN_PRODUCTION");
}

export function isPublicDemo(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return getAppMode(env) === "public-demo";
}
