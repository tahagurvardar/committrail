import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  REVIEW_STATE_META,
  ReviewStateBadge,
} from "@/components/review-state-badge";
import { REVIEW_STATES } from "@/lib/demo/types";

describe("ReviewStateBadge", () => {
  it.each(REVIEW_STATES)("labels the %s state in text", (state) => {
    render(<ReviewStateBadge state={state} />);
    const badge = screen.getByText(REVIEW_STATE_META[state].label);
    expect(badge).toBeInTheDocument();
    expect(badge.closest("[data-review-state]")).toHaveAttribute(
      "data-review-state",
      state,
    );
  });

  it("distinguishes user verification from publication", () => {
    render(<ReviewStateBadge state="verified" />);
    render(<ReviewStateBadge state="published" />);
    expect(screen.getByText("User verified")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("keeps labels and visual treatments distinct across states", () => {
    const labels = REVIEW_STATES.map((state) => REVIEW_STATE_META[state].label);
    const classNames = REVIEW_STATES.map(
      (state) => REVIEW_STATE_META[state].className,
    );
    expect(new Set(labels).size).toBe(REVIEW_STATES.length);
    expect(new Set(classNames).size).toBe(REVIEW_STATES.length);
  });
});
