import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExploreForm } from "@/components/explore/explore-form";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("ExploreForm", () => {
  it("labels the repository field accessibly and links its hint", () => {
    render(<ExploreForm />);
    const input = screen.getByRole("textbox", {
      name: "Public GitHub repository",
    });
    expect(input).toHaveAccessibleDescription(
      "owner/repository or a full github.com URL",
    );
  });

  it("shows a validation message associated with the field on invalid input", async () => {
    const user = userEvent.setup();
    render(<ExploreForm />);
    const input = screen.getByRole("textbox", {
      name: "Public GitHub repository",
    });

    await user.type(input, "https://gitlab.com/owner/repo");
    await user.click(screen.getByRole("button", { name: /fetch snapshot/i }));

    const error = await screen.findByText(
      /only public repositories on github\.com/i,
    );
    expect(error).toHaveAttribute("id", "repository-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(
      "repository-error",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to the snapshot route and announces pending state on valid input", async () => {
    const user = userEvent.setup();
    render(<ExploreForm />);

    await user.type(
      screen.getByRole("textbox", { name: "Public GitHub repository" }),
      "https://github.com/vercel/next.js.git",
    );
    await user.click(screen.getByRole("button", { name: /fetch snapshot/i }));

    expect(pushMock).toHaveBeenCalledWith("/repositories/vercel/next.js");
    expect(await screen.findByRole("status")).toHaveTextContent(
      /read-only snapshot/i,
    );
    expect(
      screen.getByRole("button", { name: /fetching snapshot/i }),
    ).toBeDisabled();
  });

  it("renders a server-provided error for the no-JavaScript flow", () => {
    render(
      <ExploreForm
        defaultValue="vercel"
        serverError="Add the repository name after a slash, e.g. owner/repository."
      />,
    );
    expect(
      screen.getByText(/add the repository name after a slash/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Public GitHub repository" }),
    ).toHaveValue("vercel");
  });

  it("clears a stale server validation error when the visitor edits the value", async () => {
    const user = userEvent.setup();
    render(
      <ExploreForm
        defaultValue="vercel"
        serverError="Add the repository name after a slash, e.g. owner/repository."
      />,
    );
    const input = screen.getByRole("textbox", {
      name: "Public GitHub repository",
    });

    await user.type(input, "/next.js");

    expect(
      screen.queryByText(/add the repository name after a slash/i),
    ).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription(
      "owner/repository or a full github.com URL",
    );
  });
});
