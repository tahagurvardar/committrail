import { expect, test } from "@playwright/test";

test("public profile lists only the PUBLIC project", async ({ page }) => {
  await page.goto("/profiles/synthetic-engineer");
  await expect(
    page.getByRole("heading", { level: 1, name: "Synthetic Engineer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Release evidence project" }),
  ).toBeVisible();
  await expect(page.getByText("Private source story")).toHaveCount(0);
  await expect(page.getByText(/example\.test/i)).toHaveCount(0);
});

test("PUBLIC project exposes only safe evidence and honest AI provenance", async ({
  page,
}) => {
  await page.goto("/projects/release-evidence-project");
  await expect(
    page.getByRole("heading", { level: 1, name: "Release evidence project" }),
  ).toBeVisible();
  await expect(page.getByText(/AI-assisted wording/i)).toBeVisible();
  const source = page.getByRole("link", {
    name: /Published the deterministic release workflow/i,
  });
  await expect(source).toHaveAttribute(
    "href",
    "https://github.com/synthetic-labs/release-evidence/releases/tag/v1.0.0",
  );
});

test("UNLISTED project is directly available, noindex, and redacted", async ({
  page,
}) => {
  await page.goto("/projects/private-source-story");
  await expect(
    page.getByRole("heading", { level: 1, name: "Private source story" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByText(/private repository and is not publicly accessible/i),
  ).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("synthetic-private");
  expect(body).not.toContain("redacted-source");
  expect(body).not.toContain("redacted-fixture");
});

test("unpublished and unknown projects share the generic not-found surface", async ({
  page,
}) => {
  for (const slug of ["unpublished-fixture", "unknown-fixture"]) {
    const response = await page.goto(`/projects/${slug}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
  }
});

test("robots, sitemap, health, and security headers are release-safe", async ({
  request,
}) => {
  const live = await request.get("/api/health/live");
  expect(live.status()).toBe(200);
  expect(live.headers()["cache-control"]).toBe("no-store");
  await expect(live.json()).resolves.toMatchObject({
    status: "live",
    version: "1.0.0",
  });

  const ready = await request.get("/api/health/ready");
  expect(ready.status()).toBe(200);
  const readyText = await ready.text();
  expect(readyText).not.toContain("postgresql://");

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /dashboard/");
  const sitemap = await request.get("/sitemap.xml");
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("/projects/release-evidence-project");
  expect(sitemapText).not.toContain("/projects/private-source-story");

  const home = await request.get("/");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["x-frame-options"]).toBe("DENY");
  expect(home.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
});
