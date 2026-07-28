import { expect, test } from "@playwright/test";
import { E2E_USER } from "./fixtures";

test("dashboard redirects unauthenticated visitors with a safe return path", async ({
  page,
}) => {
  await page.goto("/dashboard/profile");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard%2Fprofile$/);
});

test("login rejects an external return path and logout invalidates the session", async ({
  page,
}) => {
  await page.goto("/login?returnTo=https://example.test/escape");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
});

test("registration surfaces generic errors without account enumeration", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Duplicate fixture");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "We could not complete that request",
  );
});
