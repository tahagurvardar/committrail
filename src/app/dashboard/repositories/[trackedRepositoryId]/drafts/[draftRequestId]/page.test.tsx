import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizedMock, requestMock, claimsMock, refreshMock } = vi.hoisted(
  () => ({
    authorizedMock: vi.fn(),
    requestMock: vi.fn(),
    claimsMock: vi.fn(),
    refreshMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizedTrackedRepository: authorizedMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    draftGenerationRequest: { findFirst: requestMock },
    evidenceClaim: { findMany: claimsMock },
  }),
}));
vi.mock("@/lib/drafting/review-service", () => ({
  refreshDraftGroundingStatus: refreshMock,
}));
vi.mock(
  "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/actions",
  () => ({
    acceptDraftAsNewClaimAction: vi.fn(),
    acceptDraftIntoClaimAction: vi.fn(),
    regenerateDraftAction: vi.fn(),
    rejectDraftCandidateAction: vi.fn(),
  }),
);

import DraftDetailPage from "@/app/dashboard/repositories/[trackedRepositoryId]/drafts/[draftRequestId]/page";

describe("private draft detail UI", () => {
  beforeEach(() => {
    authorizedMock.mockResolvedValue({
      repository: {
        id: "repo-1",
        workspaceId: "workspace-1",
        fullName: "owner/private",
      },
    });
    refreshMock.mockResolvedValue(null);
    claimsMock.mockResolvedValue([]);
    requestMock.mockResolvedValue({
      id: "request-1",
      draftingIntent: "Explain the queue",
      status: "SUCCEEDED",
      style: "TECHNICAL",
      providerClassification: "LOCAL",
      modelLabel: "local-model",
      promptTemplateVersion: 1,
      evidenceBundleVersion: 1,
      evidenceBundleHash: "a".repeat(64),
      inputEvidenceCount: 1,
      inputByteCount: 200,
      requestDurationMs: 120,
      sanitizedErrorCode: null,
      evidenceSelections: [
        {
          evidenceContentHash: "a".repeat(64),
          repositoryEvidence: {
            id: "evidence-1",
            title: "Queue pull request",
            evidenceType: "pull-request",
            sourceAvailability: "AVAILABLE",
          },
        },
      ],
      candidate: {
        id: "candidate-1",
        title: "Queue boundary",
        reviewStatus: "READY",
        groundingStatus: "VALID",
        caveats: ["Review the selected bounded evidence."],
        policyWarnings: [],
        citedSentenceCount: 1,
        sentenceCount: 1,
        uniqueEvidenceCount: 1,
        unusedSelectedEvidenceCount: 0,
        evidenceTypesUsed: ["pull-request"],
        acceptedClaimId: null,
        rejectionReason: null,
        sentences: [
          {
            id: "sentence-1",
            text: "The queue change is recorded.",
            citations: [
              {
                repositoryEvidenceId: "evidence-1",
                selectedEvidence: {
                  repositoryEvidence: {
                    id: "evidence-1",
                    title: "Queue pull request",
                    evidenceType: "pull-request",
                    canonicalUrl: "https://github.com/owner/private/pull/42",
                  },
                },
              },
            ],
          },
        ],
      },
    });
  });

  it("shows sentence citations, caveats, grounding, and private review actions", async () => {
    render(
      await DraftDetailPage({
        params: Promise.resolve({
          trackedRepositoryId: "repo-1",
          draftRequestId: "request-1",
        }),
      }),
    );
    expect(screen.getByText("The queue change is recorded.")).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "pull-request: Queue pull request",
      }),
    ).toHaveAttribute("href", "https://github.com/owner/private/pull/42");
    expect(screen.getByText(/Grounding VALID/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Accept as new claim" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reject candidate" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /publish/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /publish/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/chain-of-thought/i)).not.toBeInTheDocument();
  });
});
