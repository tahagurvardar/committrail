import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizedMock, requestsMock, descriptorMock } = vi.hoisted(() => ({
  authorizedMock: vi.fn(),
  requestsMock: vi.fn(),
  descriptorMock: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizedTrackedRepository: authorizedMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    draftGenerationRequest: { findMany: requestsMock },
  }),
}));
vi.mock("@/lib/drafting/provider-registry", () => ({
  getGroundedDraftProviderDescriptor: descriptorMock,
}));
vi.mock(
  "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/actions",
  () => ({ regenerateDraftAction: vi.fn() }),
);

import DraftsPage from "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/page";

describe("private draft list UI", () => {
  beforeEach(() => {
    authorizedMock.mockResolvedValue({
      repository: {
        id: "repo-1",
        workspaceId: "workspace-1",
        fullName: "owner/private",
      },
    });
    descriptorMock.mockReturnValue({ configured: false });
    requestsMock.mockResolvedValue([
      {
        id: "request-1",
        draftingIntent: "Explain the queue boundary",
        style: "TECHNICAL",
        providerClassification: "LOCAL",
        status: "SUCCEEDED",
        queuedAt: new Date("2026-07-01T00:00:00Z"),
        startedAt: new Date("2026-07-01T00:00:01Z"),
        completedAt: new Date("2026-07-01T00:00:02Z"),
        sanitizedErrorCode: null,
        candidate: {
          reviewStatus: "READY",
          groundingStatus: "VALID",
          acceptedClaimId: null,
        },
        _count: { evidenceSelections: 2 },
      },
    ]);
  });

  it("shows disabled state, private history, and no publishing action", async () => {
    render(
      await DraftsPage({
        params: Promise.resolve({ trackedRepositoryId: "repo-1" }),
      }),
    );
    expect(screen.getByText(/Drafting provider not configured/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Explain the queue boundary" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/repositories/repo-1/drafts/request-1",
    );
    expect(screen.getByText(/READY · VALID/)).toBeVisible();
    expect(screen.queryByText(/publish/i)).not.toBeInTheDocument();
  });
});
