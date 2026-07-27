import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MethodologyPage from "@/app/methodology/page";

describe("methodology page", () => {
  it("explains the full pipeline including the human approval gate", () => {
    render(<MethodologyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Methodology" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "You approve, then it publishes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/publication is always a human decision/i),
    ).toBeInTheDocument();
  });

  it("shows every confidence and review state with its label", () => {
    render(<MethodologyPage />);
    for (const label of [
      "Fact",
      "Deterministic",
      "AI-assisted draft",
      "Draft",
      "Needs evidence",
      "User verified",
      "Published",
    ]) {
      // "Fact" also appears as a vocabulary term, so allow multiple matches.
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("lists the hard boundaries the product will not cross", () => {
    render(<MethodologyPage />);
    for (const boundary of [
      "Rank, score, or compare developers",
      "Treat commit counts as productivity",
      "Execute repository code",
      "Request GitHub write access",
      "Publish AI output automatically",
    ]) {
      expect(screen.getByText(boundary)).toBeInTheDocument();
    }
  });

  it("labels AI-assisted drafting honestly", () => {
    render(<MethodologyPage />);
    expect(
      screen.getByRole("heading", {
        name: "Drafts are AI-assisted, and say so",
      }),
    ).toBeInTheDocument();
  });
});
