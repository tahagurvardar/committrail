import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_META,
  ConfidenceBadge,
} from "@/components/confidence-badge";
import { CONFIDENCE_STATES } from "@/lib/demo/types";

describe("ConfidenceBadge", () => {
  it.each(CONFIDENCE_STATES)("labels the %s state in text", (state) => {
    render(<ConfidenceBadge state={state} />);
    const badge = screen.getByText(CONFIDENCE_META[state].label);
    expect(badge).toBeInTheDocument();
    expect(badge.closest("[data-confidence]")).toHaveAttribute(
      "data-confidence",
      state,
    );
  });

  it("names AI involvement explicitly in the ai-draft label", () => {
    render(<ConfidenceBadge state="ai-draft" />);
    expect(screen.getByText("AI-assisted draft")).toBeInTheDocument();
  });

  it("keeps labels and visual treatments distinct across states", () => {
    const labels = CONFIDENCE_STATES.map(
      (state) => CONFIDENCE_META[state].label,
    );
    const classNames = CONFIDENCE_STATES.map(
      (state) => CONFIDENCE_META[state].className,
    );
    expect(new Set(labels).size).toBe(CONFIDENCE_STATES.length);
    expect(new Set(classNames).size).toBe(CONFIDENCE_STATES.length);
  });
});
