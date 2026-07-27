import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import DemoPage from "@/app/demo/page";

describe("demo page", () => {
  it("declares the synthetic nature of the data up front", () => {
    render(<DemoPage />);
    expect(
      screen.getByRole("note", { name: "Synthetic demo notice" }),
    ).toHaveTextContent(/fictional/i);
  });

  it("shows the first repository by default", () => {
    render(<DemoPage />);
    expect(
      screen.getByRole("heading", { name: /knows about pulseboard/i }),
    ).toBeInTheDocument();
  });

  it("switches repositories through the accessible radio group", async () => {
    const user = userEvent.setup();
    render(<DemoPage />);

    await user.click(screen.getByRole("radio", { name: /larkql/i }));
    expect(
      await screen.findByRole("heading", { name: /knows about larkql/i }),
    ).toBeInTheDocument();
  });

  it("renders an empty state for a repository without releases", async () => {
    const user = userEvent.setup();
    render(<DemoPage />);

    await user.click(screen.getByRole("radio", { name: /driftwatch/i }));
    expect(
      await screen.findByText("No releases ingested yet"),
    ).toBeInTheDocument();
  });

  it("presents milestone source links as explicitly disabled demo controls", () => {
    render(<DemoPage />);
    const sourceButtons = screen.getAllByRole("button", {
      name: /source link disabled in the demo/i,
    });
    expect(sourceButtons.length).toBeGreaterThan(0);
    for (const button of sourceButtons) {
      expect(button).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("labels the case-study preview as an AI-assisted draft", () => {
    render(<DemoPage />);
    expect(screen.getAllByText("AI-assisted draft").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/drafts never publish automatically/i),
    ).toBeInTheDocument();
  });
});
