import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoadingRepositorySnapshot from "@/app/repositories/[owner]/[repo]/loading";
import RepositoryNotFound from "@/app/repositories/[owner]/[repo]/not-found";
import { RepositorySnapshot } from "@/components/repository/repository-snapshot";
import type { PublicRepositorySnapshot } from "@/lib/github/types";

function makeSnapshot(
  overrides: Partial<PublicRepositorySnapshot> = {},
): PublicRepositorySnapshot {
  return {
    identity: {
      owner: "acme",
      name: "rocket",
      fullName: "acme/rocket",
      url: "https://github.com/acme/rocket",
    },
    description: "Launch tooling for fictional demos.",
    ownerAvatarUrl: "https://avatars.githubusercontent.com/u/9999?v=4",
    isPrivate: false,
    defaultBranch: "main",
    archived: false,
    fork: false,
    isTemplate: false,
    createdAt: "2023-01-10T12:00:00Z",
    updatedAt: "2026-07-01T08:30:00Z",
    pushedAt: "2026-06-28T19:45:00Z",
    stars: 1234,
    forks: 56,
    openIssues: 7,
    subscribers: 21,
    license: { name: "MIT License", spdxId: "MIT" },
    topics: ["tooling", "launch"],
    primaryLanguage: "TypeScript",
    languages: [
      { name: "TypeScript", bytes: 7000, percent: 70 },
      { name: "Rust", bytes: 2000, percent: 20 },
      { name: "CSS", bytes: 1000, percent: 10 },
    ],
    homepage: "https://rocket.example.com/",
    readme: {
      present: true,
      path: "README.md",
      htmlUrl: "https://github.com/acme/rocket/blob/main/README.md",
      excerpt: "Rocket\n\nLaunch tooling for fictional demos.",
      truncated: true,
    },
    fetchedAt: "2026-07-27T12:00:00Z",
    rateLimit: { limit: 60, remaining: 55, resetAt: null },
    ...overrides,
  };
}

describe("RepositorySnapshot", () => {
  it("shows identity, description, and the public status badge", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot()} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/acme\s*\/\s*rocket/);
    expect(
      screen.getByText("Launch tooling for fictional demos."),
    ).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("labels direct GitHub data with the Fact confidence treatment", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot()} />);
    expect(screen.getByText("Fact")).toBeInTheDocument();
  });

  it("uses safe attributes on external links", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot()} />);
    for (const name of [/view on github/i, /homepage/i, /full readme/i]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("omits the homepage link when none is present", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot({ homepage: null })} />);
    expect(
      screen.queryByRole("link", { name: /homepage/i }),
    ).not.toBeInTheDocument();
  });

  it("shows archived, fork, and template states only when true", () => {
    const { rerender } = render(
      <RepositorySnapshot snapshot={makeSnapshot()} />,
    );
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(screen.queryByText("Fork")).not.toBeInTheDocument();
    expect(screen.queryByText("Template")).not.toBeInTheDocument();

    rerender(
      <RepositorySnapshot
        snapshot={makeSnapshot({
          archived: true,
          fork: true,
          isTemplate: true,
        })}
      />,
    );
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Fork")).toBeInTheDocument();
    expect(screen.getByText("Template")).toBeInTheDocument();
  });

  it("describes the language distribution accessibly", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot()} />);
    expect(
      screen.getByText(
        "Share of reported language bytes: TypeScript 70%, Rust 20%, CSS 10%.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the README excerpt with a link to the canonical page", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot()} />);
    expect(
      screen.getByText(/launch tooling for fictional demos/i, {
        selector: "blockquote",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /full readme on github/i }),
    ).toHaveAttribute(
      "href",
      "https://github.com/acme/rocket/blob/main/README.md",
    );
    expect(screen.getByText(/plain-text excerpt only/i)).toBeInTheDocument();
  });

  it("treats a missing README as a normal state", () => {
    render(
      <RepositorySnapshot
        snapshot={makeSnapshot({
          readme: {
            present: false,
            path: null,
            htmlUrl: null,
            excerpt: null,
            truncated: false,
          },
        })}
      />,
    );
    expect(screen.getByText("No README detected")).toBeInTheDocument();
  });

  it("discloses the data source, freshness window, and read-only access", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot()} />);
    expect(screen.getByText(/never writes to github/i)).toBeInTheDocument();
    expect(screen.getByText(/delayed by a few minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/no scoring, no ranking/i)).toBeInTheDocument();
  });

  it("distinguishes the live snapshot from the synthetic demo", () => {
    render(<RepositorySnapshot snapshot={makeSnapshot()} />);
    expect(
      screen.getByText(/live public repository evidence/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /synthetic demo/i }),
    ).toHaveAttribute("href", "/demo");
  });
});

describe("snapshot route chrome", () => {
  it("announces the loading state accessibly", () => {
    render(<LoadingRepositorySnapshot />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /loading repository snapshot/i,
    );
  });

  it("presents 404s as not-found-or-not-accessible, without guessing", () => {
    render(<RepositoryNotFound />);
    expect(
      screen.getByRole("heading", {
        name: "Repository not found or not publicly accessible.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /try another repository/i }),
    ).toHaveAttribute("href", "/explore");
  });
});
