import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizedMock, evidenceMock, descriptorMock, consentMock } =
  vi.hoisted(() => ({
    authorizedMock: vi.fn(),
    evidenceMock: vi.fn(),
    descriptorMock: vi.fn(),
    consentMock: vi.fn(),
  }));

vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizedTrackedRepository: authorizedMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ repositoryEvidence: { findMany: evidenceMock } }),
}));
vi.mock("@/lib/drafting/provider-registry", () => ({
  getGroundedDraftProviderDescriptor: descriptorMock,
}));
vi.mock("@/lib/drafting/consent-service", () => ({
  hasCurrentExternalConsent: consentMock,
}));
vi.mock(
  "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/actions",
  () => ({
    queueDraftGenerationAction: vi.fn(),
    grantDraftingConsentAction: vi.fn(),
    revokeDraftingConsentAction: vi.fn(),
  }),
);

import NewDraftPage from "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/new/page";

describe("new private draft UI", () => {
  beforeEach(() => {
    authorizedMock.mockResolvedValue({
      repository: {
        id: "repo-1",
        workspaceId: "workspace-1",
        fullName: "owner/private",
      },
    });
    descriptorMock.mockReturnValue({
      configured: true,
      classification: "EXTERNAL",
      modelLabel: "configured-model",
      maximumEvidenceCount: 12,
      maximumRequestBytes: 65536,
      maximumOutputBytes: 16384,
    });
    consentMock.mockResolvedValue(false);
    evidenceMock.mockResolvedValue([
      {
        id: "evidence-1",
        title: "Queue pull request",
        evidenceType: "pull-request",
        occurredAt: new Date("2026-07-01T00:00:00Z"),
        factualPayload: { number: 42, state: "closed" },
      },
    ]);
  });

  it("requires external consent and renders bounded accessible controls", async () => {
    const user = userEvent.setup();
    render(
      await NewDraftPage({
        params: Promise.resolve({ trackedRepositoryId: "repo-1" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByText(/selected normalized evidence leaves/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Grant consent for this provider",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Private drafting intent" }),
    ).toHaveAttribute("maxlength", "500");
    expect(
      screen.getByRole("checkbox", { name: /Queue pull request/ }),
    ).toBeVisible();
    expect(screen.getByText(/Selected 0\/12 facts/i)).toBeVisible();
    await user.click(
      screen.getByRole("checkbox", { name: /Queue pull request/ }),
    );
    expect(screen.getByText(/Selected 1\/12 facts/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Queue private grounded draft" }),
    ).toBeDisabled();
    expect(screen.queryByText(/chain-of-thought/i)).not.toBeInTheDocument();
  });
});
