import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/publishing/profile-service", () => ({
  getAuthorizedPublicProfile: vi.fn().mockResolvedValue({
    profile: null,
    session: {
      user: {
        name: "Profile Owner",
        email: "private-email@example.test",
      },
    },
  }),
  savePublicProfile: vi.fn(),
}));

describe("public profile editor", () => {
  it("labels bounded public fields and explains email omission", async () => {
    const { default: Page } = await import("./page");
    render(await Page());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Public profile",
    );
    expect(screen.getByLabelText(/Profile slug/)).toBeRequired();
    expect(screen.getByLabelText("Visibility")).toHaveValue("PRIVATE");
    expect(
      screen.getByText(/account email.*never included/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("private-email@example.test"),
    ).not.toBeInTheDocument();
  });
});
