import { expect, test } from "@playwright/test";
import { AUTH_STATE, E2E_IDS } from "./fixtures";

test.use({ storageState: AUTH_STATE });

test("workspace navigation exposes deterministic repository and evidence state", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { level: 1, name: /workspace/i }),
  ).toBeVisible();
  await expect(page.getByText("Tracked repositories").first()).toBeVisible();

  await page.goto(`/dashboard/repositories/${E2E_IDS.publicRepository}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "synthetic-labs/release-evidence",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Evidence library/i }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Evidence library" }),
  ).toBeVisible();
  await expect(
    page.getByText("Published the deterministic release workflow"),
  ).toBeVisible();
});

test("claim graph, profile, publication, and output surfaces retain provenance", async ({
  page,
}) => {
  await page.goto(
    `/dashboard/repositories/${E2E_IDS.publicRepository}/claims/${E2E_IDS.publicClaim}`,
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Built a deterministic release gate/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/not independent certification/i)).toBeVisible();

  await page.goto("/dashboard/profile");
  await expect(page.locator('input[value="synthetic-engineer"]')).toBeVisible();
  await page.goto("/dashboard/publications");
  await expect(page.getByText("Release evidence project")).toBeVisible();
  await expect(page.getByText("Private source story")).toBeVisible();

  await page.goto("/dashboard/outputs");
  await expect(page.getByText("Release gate case study")).toBeVisible();
  await page.goto(`/dashboard/outputs/${E2E_IDS.output}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Release gate case study" }),
  ).toBeVisible();
});

test("private output downloads are authenticated, bounded, and uncached", async ({
  request,
}) => {
  for (const format of ["txt", "md", "json"]) {
    const response = await request.get(
      `/api/outputs/${E2E_IDS.output}/download?format=${format}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private");
    expect(response.headers()["content-disposition"]).toContain("attachment");
    expect((await response.body()).byteLength).toBeLessThanOrEqual(128 * 1024);
  }
});

test("dashboard remains usable at the 375px release viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.goto("/dashboard");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
