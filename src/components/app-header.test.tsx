import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppHeader } from "@/components/app-header";

describe("AppHeader", () => {
  it("links the wordmark to the home page", () => {
    render(<AppHeader />);
    expect(screen.getByRole("link", { name: /committrail/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("exposes the main navigation with the three product routes", () => {
    render(<AppHeader />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Product" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(
      within(nav).getByRole("link", { name: "Methodology" }),
    ).toHaveAttribute("href", "/methodology");
    expect(within(nav).getByRole("link", { name: "Demo" })).toHaveAttribute(
      "href",
      "/demo",
    );
  });

  it("marks the GitHub action as unavailable in Phase 0", () => {
    render(<AppHeader />);
    const gitHubButton = screen.getByRole("button", {
      name: /github.*unavailable in phase 0/i,
    });
    expect(gitHubButton).toHaveAttribute("aria-disabled", "true");
  });

  it("gives the theme toggle an accessible name", () => {
    render(<AppHeader />);
    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
  });
});
