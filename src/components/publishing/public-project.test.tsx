import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProject } from "./public-project";
import type { PublicProjectView } from "@/lib/publishing/types";

const project: PublicProjectView = {
  schemaVersion: 1,
  slug: "safe-project",
  title: "Safe project",
  summary: "A deliberately published project.",
  role: "Maintainer",
  period: "2026",
  technologies: ["TypeScript"],
  problem: "A bounded problem.",
  approach: "A reviewed approach.",
  outcome: "A factual outcome.",
  repositoryDisclosurePolicy: "IDENTITY_REDACTED",
  publicRepositoryLabel: null,
  publicRepositoryUrl: null,
  visibility: "UNLISTED",
  author: {
    slug: "safe-author",
    displayName: "Safe Author",
    headline: "Engineer",
    biography: "Evidence-backed work.",
    location: null,
    personalWebsiteUrl: null,
    githubProfileUrl: null,
  },
  claims: [
    {
      identifier: "claim-public",
      statement: "Published a reviewed release.",
      origin: "AI_ASSISTED",
      verifiedAt: "2026-07-28T00:00:00.000Z",
      humanEdited: true,
      aiAssistedDisclosure:
        "AI-assisted wording, reviewed and verified by the author.",
      evidence: [
        {
          identifier: "evidence-public",
          type: "release",
          title: "Private repository evidence",
          occurredAt: null,
          disclosureMode: "PRIVATE_SOURCE_REDACTED",
          sourceUrl: null,
          provenance:
            "Source evidence belongs to a private repository and is not publicly accessible.",
          confidence: "FACT",
        },
      ],
    },
  ],
  publishedAt: "2026-07-28T00:00:00.000Z",
  revisionNumber: 1,
  contentHash: "a".repeat(64),
  health: "CURRENT",
  healthNotice: null,
};

describe("PublicProject", () => {
  it("renders semantic public evidence and transparent AI-assisted wording", () => {
    render(<PublicProject project={project} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/AI-assisted wording/)).toBeInTheDocument();
    expect(screen.getByText(/not publicly accessible/)).toBeInTheDocument();
    expect(
      screen.queryByText(/workspace|internal ID/i),
    ).not.toBeInTheDocument();
  });

  it("labels exact previews and robots behavior", () => {
    render(<PublicProject project={project} preview />);
    expect(screen.getByLabelText("Unpublished preview")).toHaveTextContent(
      "noindex, follow",
    );
  });
});
