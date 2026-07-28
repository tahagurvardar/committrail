import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PublicationEditor } from "./publication-editor";

const repositories = [
  {
    id: "repo-private",
    fullName: "private/repository",
    visibility: "private",
    claims: [
      {
        id: "claim-one",
        statement: "Implemented a reviewed workflow.",
        origin: "AI_ASSISTED" as const,
        evidence: [
          {
            id: "evidence-one",
            title: "Private source title",
            evidenceType: "commit",
            occurredAt: "2026-07-28T00:00:00.000Z",
          },
        ],
      },
    ],
  },
];

describe("PublicationEditor", () => {
  it("shows deliberate visibility, private disclosure, and AI transparency controls", () => {
    render(<PublicationEditor repositories={repositories} />);
    expect(screen.getByLabelText("Public visibility")).toHaveTextContent(
      "UNLISTED",
    );
    expect(screen.getByLabelText("Disclosure mode")).toHaveValue(
      "PRIVATE_SOURCE_REDACTED",
    );
    expect(screen.getByText(/AI-assisted wording/)).toBeInTheDocument();
    expect(screen.getByText(/never included/)).toBeInTheDocument();
  });

  it("provides keyboard-operable move controls", async () => {
    const user = userEvent.setup();
    render(<PublicationEditor repositories={repositories} />);
    const position = screen.getByLabelText("Position");
    expect(position).toHaveValue(0);
    await user.click(screen.getByRole("button", { name: "Move claim down" }));
    expect(position).toHaveValue(1);
    await user.click(screen.getByRole("button", { name: "Move claim up" }));
    expect(position).toHaveValue(0);
  });
});
