import { expect, test } from "@playwright/test";

for (const route of [
  "/",
  "/explore",
  "/profiles/synthetic-engineer",
  "/projects/release-evidence-project",
]) {
  test(`${route} stays within deterministic public-page budgets`, async ({
    page,
  }) => {
    const started = Date.now();
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      scriptBytes: performance
        .getEntriesByType("resource")
        .filter(
          (entry) =>
            entry.name.includes("/_next/static/") && entry.name.endsWith(".js"),
        )
        .reduce(
          (total, entry) =>
            total + ((entry as PerformanceResourceTiming).transferSize || 0),
          0,
        ),
    }));
    expect(metrics.overflow).toBe(false);
    expect(metrics.scriptBytes).toBeLessThan(825_000);
  });
}
