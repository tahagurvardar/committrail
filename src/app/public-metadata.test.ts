import { afterEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    publicProfile: { findMany: vi.fn() },
    projectPublication: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prismaMock }));

describe("public robots and sitemap policy", () => {
  afterEach(() => {
    delete process.env.PUBLIC_APP_URL;
  });

  it("disallows private surfaces in robots policy", async () => {
    const { default: robots } = await import("./robots");
    const policy = robots();
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
    expect(rules[0].disallow).toContain("/dashboard/");
    expect(rules[0].disallow).toContain("/api/");
  });

  it("returns no sitemap when a safe canonical public origin is absent", async () => {
    const { default: sitemap } = await import("./sitemap");
    await expect(sitemap()).resolves.toEqual([]);
    expect(prismaMock.publicProfile.findMany).not.toHaveBeenCalled();
  });

  it("includes only records already scoped as PUBLIC by the query", async () => {
    process.env.PUBLIC_APP_URL = "https://committrail.example";
    prismaMock.publicProfile.findMany.mockResolvedValue([
      { slug: "safe-profile", updatedAt: new Date("2026-07-28T00:00:00Z") },
    ]);
    prismaMock.projectPublication.findMany.mockResolvedValue([
      {
        slug: "safe-project",
        latestPublishedAt: new Date("2026-07-28T00:00:00Z"),
      },
    ]);
    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://committrail.example/profiles/safe-profile",
      "https://committrail.example/projects/safe-project",
    ]);
    expect(
      prismaMock.projectPublication.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      status: "PUBLISHED",
      visibility: "PUBLIC",
      profile: { visibility: "PUBLIC" },
    });
  });
});
