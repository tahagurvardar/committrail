import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizedMock, findManyMock } = vi.hoisted(() => ({
  authorizedMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizedTrackedRepository: authorizedMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ repositoryEvidence: { findMany: findManyMock } }),
}));

import EvidenceLibraryPage from "@/app/dashboard/repositories/[trackedRepositoryId]/evidence/page";

describe("evidence library UI", () => {
  beforeEach(() => {
    authorizedMock.mockResolvedValue({
      repository: {
        id: "repo-1",
        workspaceId: "workspace-1",
        fullName: "owner/private",
      },
    });
    findManyMock.mockResolvedValue([
      {
        id: "evidence-1",
        evidenceType: "release",
        sourceAvailability: "AVAILABLE",
        canonicalUrl: "https://github.com/owner/private/releases/tag/v1",
        title: "Release v1",
        firstSeenAt: new Date("2026-07-01T00:00:00Z"),
        lastSeenAt: new Date("2026-07-02T00:00:00Z"),
        _count: { observations: 2, claimLinks: 1 },
        observations: [{ sourceKind: "WEBHOOK" }],
      },
    ]);
  });

  it("renders accessible bounded filters, fact labels, provenance, and safe links", async () => {
    render(
      await EvidenceLibraryPage({
        params: Promise.resolve({ trackedRepositoryId: "repo-1" }),
        searchParams: Promise.resolve({ type: "release", q: "Release" }),
      }),
    );
    expect(screen.getByRole("textbox", { name: "Search titles" })).toHaveValue(
      "Release",
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeVisible();
    expect(screen.getByText("release · Fact")).toBeVisible();
    expect(screen.getByText(/2 · latest webhook/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Release v1" })).toHaveAttribute(
      "href",
      "https://github.com/owner/private/releases/tag/v1",
    );
    expect(screen.getByText(/at most 100/)).toBeVisible();
  });
});
