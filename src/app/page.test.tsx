import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { TRUST_PRINCIPLES } from "@/lib/trust-principles";

describe("landing page", () => {
  it("leads with the product tagline", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn GitHub history into evidence-backed engineering stories.",
      }),
    ).toBeInTheDocument();
  });

  it("offers the demo as primary action and the methodology as secondary", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("link", { name: /explore the demo/i }),
    ).toHaveAttribute("href", "/demo");
    expect(
      screen.getByRole("link", { name: /read the methodology/i }),
    ).toHaveAttribute("href", "/methodology");
  });

  it("walks through the four workflow steps", () => {
    render(<HomePage />);
    for (const step of ["Connect", "Collect", "Verify", "Publish"]) {
      expect(
        screen.getByRole("heading", { level: 3, name: step }),
      ).toBeInTheDocument();
    }
  });

  it("shows the evidence graph with an accessible description", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("img", {
        name: /evidence graph for one verified claim/i,
      }),
    ).toBeInTheDocument();
  });

  it("states every trust principle", () => {
    render(<HomePage />);
    for (const principle of TRUST_PRINCIPLES) {
      expect(screen.getByText(principle.title)).toBeInTheDocument();
    }
  });

  it("discloses the private workspace boundary honestly", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/connected workspace data stays private/i),
    ).toBeInTheDocument();
  });
});
