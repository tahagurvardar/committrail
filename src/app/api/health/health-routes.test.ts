import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ $queryRaw: query }),
}));

describe("operational health routes", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("reports liveness without touching the database", async () => {
    const { GET } = await import("./live/route");
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "live",
      version: "1.0.0",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("reports readiness without exposing configuration values", async () => {
    query.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("./ready/route");
    const response = await GET();
    const serialized = JSON.stringify(await response.json());
    expect(response.status).toBe(200);
    expect(serialized).toContain('"status":"ready"');
    expect(serialized).not.toContain("postgresql://");
  });

  it("returns a sanitized unavailable result", async () => {
    query.mockRejectedValue(new Error("postgresql://private-host"));
    const { GET } = await import("./ready/route");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private-host");
  });
});
