import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutputEditor } from "./output-editor";

describe("OutputEditor", () => {
  it("offers all deterministic output builders and private downloads workflow", () => {
    render(
      <OutputEditor
        repositories={[
          {
            id: "repo",
            fullName: "owner/repo",
            claims: [
              {
                id: "claim",
                statement: "Shipped a reviewed release.",
                origin: "HUMAN",
              },
            ],
          },
        ]}
      />,
    );
    const template = screen.getByLabelText("Deterministic template");
    expect(template).toHaveTextContent("Case study");
    expect(template).toHaveTextContent("CV bullets");
    expect(template).toHaveTextContent("Interview story");
    expect(screen.getByText(/No metrics.*invented/i)).toBeInTheDocument();
    expect(screen.queryByText(/generate with AI/i)).not.toBeInTheDocument();
  });
});
