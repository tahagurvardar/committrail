import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  SnapshotErrorState,
  type SnapshotErrorDetails,
} from "@/components/repository/snapshot-error-state";

function renderError(details: Partial<SnapshotErrorDetails>) {
  const error: SnapshotErrorDetails = {
    code: "upstream-unavailable",
    message: "GitHub is currently unavailable. Please try again in a moment.",
    retryAfterSeconds: null,
    rateLimitResetAt: null,
    ...details,
  };
  return render(
    <SnapshotErrorState owner="acme" repo="rocket" error={error} />,
  );
}

describe("SnapshotErrorState", () => {
  it("explains rate limiting with the reset time when GitHub provides one", () => {
    renderError({
      code: "rate-limited",
      message: "GitHub temporarily rate-limited requests from this site.",
      rateLimitResetAt: "2026-07-27T13:00:00.000Z",
      retryAfterSeconds: 120,
    });
    expect(
      screen.getByRole("heading", { name: /github rate-limited this site/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jul 27, 2026, 13:00 UTC")).toBeInTheDocument();
    expect(screen.getByText(/2 min/)).toBeInTheDocument();
    expect(
      screen.getByText(/nothing is wrong with the repository/i),
    ).toBeInTheDocument();
  });

  it("does not invent an exact retry time for a secondary limit", () => {
    renderError({
      code: "rate-limited",
      message: "GitHub temporarily rate-limited requests from this site.",
    });
    expect(
      screen.getByText(/did not provide reliable retry timing/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/the limit resets at/i)).not.toBeInTheDocument();
  });

  it("frames a token problem as a server configuration issue, not the visitor's", () => {
    renderError({
      code: "auth-config",
      message:
        "The server’s optional GitHub credentials were rejected. This is a site configuration problem — you don’t need to provide anything.",
    });
    expect(
      screen.getByText(/you don’t need an account or a token/i),
    ).toBeInTheDocument();
  });

  it("reports upstream unavailability honestly with a retry path", () => {
    renderError({ code: "upstream-unavailable" });
    expect(
      screen.getByRole("heading", { name: /github is unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/repositories/acme/rocket",
    );
  });

  it("names the repository that was attempted", () => {
    renderError({
      code: "timeout",
      message: "GitHub did not respond in time.",
    });
    expect(screen.getByText("acme/rocket")).toBeInTheDocument();
  });
});
