import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "@/app/not-found";

describe("not-found page", () => {
  it("explains the missing page in product language", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This trail doesn’t exist.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/404 — no evidence found/i)).toBeInTheDocument();
  });

  it("offers routes back to the start and the demo", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("link", { name: /back to the start/i }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: /open the demo/i }),
    ).toHaveAttribute("href", "/demo");
  });
});
