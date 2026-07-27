import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClaimEvidenceGraph } from "@/components/claims/claim-evidence-graph";

describe("claim evidence graph", () => {
  it("provides an accessible graph and complete textual equivalent", () => {
    render(
      <ClaimEvidenceGraph
        statement="Improved release reliability."
        evidence={[
          {
            id: "evidence-1",
            title: "Release v1.0",
            evidenceType: "release",
            canonicalUrl: "https://github.com/owner/repo/releases/tag/v1",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("img", { name: /Claim and linked evidence/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Text equivalent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Release v1.0" })).toHaveAttribute(
      "href",
      "https://github.com/owner/repo/releases/tag/v1",
    );
  });

  it("describes an empty graph without colour-only meaning", () => {
    render(<ClaimEvidenceGraph statement="Draft claim" evidence={[]} />);
    expect(screen.getByText("No evidence is linked.")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /connected to 0 GitHub facts/ }),
    ).toBeInTheDocument();
  });
});
