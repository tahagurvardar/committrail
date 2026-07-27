import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppFooter } from "@/components/app-footer";

describe("AppFooter", () => {
  it("uses the Phase 1A status without stale Phase 0 labeling", () => {
    render(<AppFooter />);
    expect(screen.getByText("Phase 1A snapshot")).toBeInTheDocument();
    expect(screen.queryByText(/phase 0 preview/i)).not.toBeInTheDocument();
  });

  it("links to the public source repository with safe external attributes", () => {
    render(<AppFooter />);
    expect(
      screen.getByRole("link", { name: "Source repository" }),
    ).toHaveAttribute("href", "https://github.com/tahagurvardar/committrail");
    expect(
      screen.getByRole("link", { name: "Source repository" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  });
});
