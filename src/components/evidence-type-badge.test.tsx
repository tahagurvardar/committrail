import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  EVIDENCE_TYPE_META,
  EvidenceTypeBadge,
} from "@/components/evidence-type-badge";
import { EVIDENCE_TYPES } from "@/lib/demo/types";

describe("EvidenceTypeBadge", () => {
  it.each(EVIDENCE_TYPES)("renders a text label for %s", (type) => {
    render(<EvidenceTypeBadge type={type} />);
    const badge = screen.getByText(EVIDENCE_TYPE_META[type].label);
    expect(badge).toBeInTheDocument();
    expect(badge.closest("[data-evidence-type]")).toHaveAttribute(
      "data-evidence-type",
      type,
    );
  });

  it("gives every evidence type a distinct label", () => {
    const labels = EVIDENCE_TYPES.map((type) => EVIDENCE_TYPE_META[type].label);
    expect(new Set(labels).size).toBe(EVIDENCE_TYPES.length);
  });

  it("marks its icon as decorative so the label carries the meaning", () => {
    const { container } = render(<EvidenceTypeBadge type="commit" />);
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
