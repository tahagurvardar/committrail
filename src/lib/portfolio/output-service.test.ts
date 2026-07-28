import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/authorization", () => ({
  requireWorkspaceOwner: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: vi.fn() }));

describe("deterministic portfolio output helpers", () => {
  it("does not import or require any model-provider module", async () => {
    const source = await import("./output-service");
    expect(source.createPortfolioOutputForAuthority).toBeTypeOf("function");
    expect(source.buildPrivateOutputDownload).toBeTypeOf("function");
  });
});
