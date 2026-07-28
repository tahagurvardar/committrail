import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppFooter } from "@/components/app-footer";

describe("AppFooter", () => {
  it("uses the stable release status without stale phase labeling", () => {
    render(<AppFooter />);
    expect(
      screen.getByText(/v1\.0\.0 · Release-hardened/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/phase \d/i)).not.toBeInTheDocument();
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
