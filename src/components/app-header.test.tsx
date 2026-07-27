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

  it("exposes the main navigation with the product routes", () => {
    render(<AppHeader />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Explore" })).toHaveAttribute(
      "href",
      "/explore",
    );
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

  it("links the primary action to the live explore flow", () => {
    render(<AppHeader />);
    expect(
      screen.getByRole("link", { name: /explore a repository/i }),
    ).toHaveAttribute("href", "/explore");
  });

  it("gives the theme toggle an accessible name", () => {
    render(<AppHeader />);
    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
  });
});
