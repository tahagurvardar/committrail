import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_STATE, E2E_IDS } from "./fixtures";

const publicRoutes = [
  "/",
  "/explore",
  "/demo",
  "/login",
  "/register",
  "/profiles/synthetic-engineer",
  "/projects/release-evidence-project",
] as const;

for (const route of publicRoutes) {
  test(`@accessibility ${route} has no serious automated violations`, async ({
    page,
  }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(
      results.violations.filter(({ impact }) =>
        ["serious", "critical"].includes(impact ?? ""),
      ),
    ).toEqual([]);
  });
}

test.describe("authenticated accessibility", () => {
  test.use({ storageState: AUTH_STATE });
  for (const route of [
    "/dashboard",
    `/dashboard/repositories/${E2E_IDS.publicRepository}/evidence`,
    `/dashboard/repositories/${E2E_IDS.publicRepository}/claims/${E2E_IDS.publicClaim}`,
    "/dashboard/publications/e2e-public-publication/preview",
    "/dashboard/outputs/new",
  ]) {
    test(`@accessibility ${route} has no serious automated violations`, async ({
      page,
    }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
      expect(
        results.violations.filter(({ impact }) =>
          ["serious", "critical"].includes(impact ?? ""),
        ),
      ).toEqual([]);
    });
  }
});
