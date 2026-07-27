import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizedMock, claimMock, evidenceMock } = vi.hoisted(() => ({
  authorizedMock: vi.fn(),
  claimMock: vi.fn(),
  evidenceMock: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizedTrackedRepository: authorizedMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    evidenceClaim: { findFirst: claimMock },
    repositoryEvidence: { findMany: evidenceMock },
  }),
}));
vi.mock(
  "@/app/dashboard/repositories/[trackedRepositoryId]/claims/actions",
  () => ({
    claimStatusAction: vi.fn(),
    editClaimAction: vi.fn(),
    linkEvidenceAction: vi.fn(),
    unlinkEvidenceAction: vi.fn(),
  }),
);
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

import ClaimDetailPage from "@/app/dashboard/repositories/[trackedRepositoryId]/claims/[claimId]/page";

describe("claim detail UI", () => {
  beforeEach(() => {
    authorizedMock.mockResolvedValue({
      repository: {
        id: "repo-1",
        workspaceId: "workspace-1",
        fullName: "owner/private",
      },
    });
    claimMock.mockResolvedValue({
      id: "claim-1",
      statement: "Shipped a durable queue.",
      status: "VERIFIED",
      version: 3,
      author: { name: "Owner" },
      evidenceLinks: [
        {
          repositoryEvidenceId: "evidence-1",
          repositoryEvidence: {
            id: "evidence-1",
            evidenceType: "pull-request",
            sourceAvailability: "AVAILABLE",
            canonicalUrl: "https://github.com/owner/private/pull/1",
            title: "Queue pull request",
            firstSeenAt: new Date("2026-07-01T00:00:00Z"),
            lastSeenAt: new Date("2026-07-02T00:00:00Z"),
            observations: [{ id: "observation-1" }],
          },
        },
      ],
      revisions: [
        {
          id: "revision-3",
          revisionNumber: 3,
          kind: "VERIFIED",
          changeSummary: "Claim owner-reviewed.",
          status: "VERIFIED",
          createdAt: new Date("2026-07-28T00:00:00Z"),
          actor: { name: "Owner" },
        },
      ],
    });
    evidenceMock.mockResolvedValue([
      {
        id: "evidence-2",
        evidenceType: "release",
        title: "Release v1",
      },
    ]);
  });

  it("shows explicit review warning, keyboard links, picker, graph text, and revisions", async () => {
    render(
      await ClaimDetailPage({
        params: Promise.resolve({
          trackedRepositoryId: "repo-1",
          claimId: "claim-1",
        }),
      }),
    );
    expect(screen.getByText(/not independent certification/i)).toBeVisible();
    expect(
      screen.getByRole("img", { name: /Claim and linked evidence/ }),
    ).toBeVisible();
    expect(screen.getByText("Text equivalent")).toBeVisible();
    for (const link of screen.getAllByRole("link", {
      name: "Queue pull request",
    })) {
      expect(link).toHaveAttribute("target", "_blank");
    }
    expect(screen.getByRole("button", { name: "Link evidence" })).toBeVisible();
    expect(screen.getByText("v3 · VERIFIED")).toBeVisible();
  });
});
