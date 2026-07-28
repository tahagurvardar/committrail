import { expect, test } from "@playwright/test";

test("landing page presents the product and routes to the demo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Turn GitHub history into evidence-backed engineering stories.",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: /explore the demo/i }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("note", { name: "Synthetic demo notice" }),
  ).toBeVisible();
});

test("main navigation reaches the methodology page", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Methodology" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Methodology" }),
  ).toBeVisible();
});

test("invalid explorer input is rejected without an external request", async ({
  page,
}) => {
  await page.goto("/explore");
  await page.getByLabel(/repository/i).fill("https://example.test/private");
  await page.getByRole("button", { name: /snapshot/i }).click();
  await expect(page).toHaveURL(/repository=/);
  await expect(page.getByRole("alert")).toBeVisible();
});
