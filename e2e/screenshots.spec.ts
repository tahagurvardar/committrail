import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { AUTH_STATE, E2E_IDS } from "./fixtures";

const directory = "docs/assets/screenshots";

test.beforeAll(async () => mkdir(directory, { recursive: true }));

for (const [name, route, heading] of [
  ["landing", "/", /Turn GitHub history/i],
  ["demo", "/demo", /Synthetic demo/i],
  ["public-profile", "/profiles/synthetic-engineer", /Synthetic Engineer/i],
  [
    "public-project",
    "/projects/release-evidence-project",
    /Release evidence project/i,
  ],
] as const) {
  test(`captures ${name} release documentation`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.goto(route);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await page.screenshot({
      path: `${directory}/${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

test.describe("authenticated screenshot", () => {
  test.use({ storageState: AUTH_STATE });
  test("captures dashboard release documentation", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.goto(`/dashboard/repositories/${E2E_IDS.publicRepository}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "synthetic-labs/release-evidence",
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `${directory}/dashboard.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
});
