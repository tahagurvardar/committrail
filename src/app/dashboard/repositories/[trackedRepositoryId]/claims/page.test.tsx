import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizedMock, claimsMock } = vi.hoisted(() => ({
  authorizedMock: vi.fn(),
  claimsMock: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizedTrackedRepository: authorizedMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ evidenceClaim: { findMany: claimsMock } }),
}));
vi.mock(
  "@/app/dashboard/repositories/[trackedRepositoryId]/claims/actions",
  () => ({ createClaimAction: vi.fn() }),
);

import ClaimsPage from "@/app/dashboard/repositories/[trackedRepositoryId]/claims/page";

describe("claims list UI", () => {
  beforeEach(() => {
    authorizedMock.mockResolvedValue({
      repository: {
        id: "repo-1",
        workspaceId: "workspace-1",
        fullName: "owner/private",
      },
    });
    claimsMock.mockResolvedValue([
      {
        id: "claim-1",
        statement: "Shipped a durable queue.",
        status: "VERIFIED",
        updatedAt: new Date("2026-07-28T00:00:00Z"),
        author: { name: "Owner" },
        evidenceLinks: [
          { repositoryEvidence: { evidenceType: "pull-request" } },
        ],
      },
    ]);
  });

  it("renders the bounded plain-text form and human verification state", async () => {
    render(
      await ClaimsPage({
        params: Promise.resolve({ trackedRepositoryId: "repo-1" }),
      }),
    );
    const statement = screen.getByRole("textbox", {
      name: "New claim statement",
    });
    expect(statement).toHaveAttribute("maxlength", "500");
    expect(statement).toHaveAccessibleDescription(/Plain text/);
    expect(
      screen.getByText(/explicitly accepted AI-assisted suggestions/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Open private grounded drafts/ }),
    ).toHaveAttribute("href", "/dashboard/repositories/repo-1/drafts");
    expect(
      screen.getByRole("link", { name: "Shipped a durable queue." }),
    ).toBeVisible();
    expect(screen.getByText(/VERIFIED.*Human origin/)).toBeVisible();
    expect(screen.getByText(/1 linked fact/)).toBeVisible();
  });
});
