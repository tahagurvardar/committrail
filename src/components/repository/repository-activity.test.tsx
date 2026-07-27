import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RepositoryActivity } from "@/components/repository/repository-activity";
import type {
  ActivitySection,
  CommitEvidence,
  IssueEvidence,
  PublicRepositoryActivity,
  PullRequestEvidence,
  ReleaseEvidence,
  WorkflowRunEvidence,
} from "@/lib/github/activity-types";

const SHA = "a".repeat(40);

function available<T>(
  items: T[],
  sampleLimit = 20,
  hasMore = false,
  discardedRecordCount = 0,
): ActivitySection<T> {
  return {
    status: "available",
    items,
    pagination: { hasMore, returnedCount: items.length, sampleLimit },
    discardedRecordCount,
  };
}

function commit(): CommitEvidence {
  return {
    evidenceId: `github:commit:${SHA}`,
    evidenceType: "commit",
    sourceIdentifier: SHA,
    sourceUrl: `https://github.com/acme/rocket/commit/${SHA}`,
    occurredAt: "2026-07-27T12:00:00.000Z",
    title: "Safe first line",
    source: "GitHub",
    confidence: "fact",
    sha: SHA,
    shortSha: "aaaaaaa",
    committedAt: "2026-07-27T12:00:00.000Z",
    authorLogin: null,
    authorDisplayName: "Fallback Author",
    verification: "verified",
  };
}

function pull(): PullRequestEvidence {
  return {
    evidenceId: "github:pull-request:2",
    evidenceType: "pull-request",
    sourceIdentifier: "2",
    sourceUrl: "https://github.com/acme/rocket/pull/2",
    occurredAt: "2026-07-27T11:00:00.000Z",
    title: "Evidence PR",
    source: "GitHub",
    confidence: "fact",
    databaseId: 2,
    number: 2,
    state: "closed",
    draft: false,
    authorLogin: "octocat",
    createdAt: "2026-07-26T11:00:00.000Z",
    updatedAt: "2026-07-27T11:00:00.000Z",
    closedAt: "2026-07-27T11:00:00.000Z",
    mergedAt: "2026-07-27T11:00:00.000Z",
    baseBranch: "main",
    headBranch: "feature",
  };
}

function issue(): IssueEvidence {
  return {
    evidenceId: "github:issue:3",
    evidenceType: "issue",
    sourceIdentifier: "3",
    sourceUrl: "https://github.com/acme/rocket/issues/3",
    occurredAt: "2026-07-27T10:00:00.000Z",
    title: "Evidence issue",
    source: "GitHub",
    confidence: "fact",
    databaseId: 3,
    number: 3,
    state: "open",
    stateReason: "reopened",
    authorLogin: null,
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-27T10:00:00.000Z",
    closedAt: null,
    commentCount: 2,
    labels: [{ name: "docs", color: "0e8a16" }],
  };
}

function release(id: number, day: number): ReleaseEvidence {
  const timestamp = `2026-07-${String(day).padStart(2, "0")}T09:00:00.000Z`;
  return {
    evidenceId: `github:release:${id}`,
    evidenceType: "release",
    sourceIdentifier: String(id),
    sourceUrl: `https://github.com/acme/rocket/releases/tag/v${id}`,
    occurredAt: timestamp,
    title: `Release v${id}`,
    source: "GitHub",
    confidence: "fact",
    databaseId: id,
    tagName: `v${id}`,
    releaseName: `Release v${id}`,
    draft: false,
    prerelease: id === 3,
    immutable: null,
    createdAt: timestamp,
    publishedAt: timestamp,
    authorLogin: null,
    assetCount: 0,
  };
}

function workflow(): WorkflowRunEvidence {
  return {
    evidenceId: "github:workflow-run:4",
    evidenceType: "workflow-run",
    sourceIdentifier: "4",
    sourceUrl: "https://github.com/acme/rocket/actions/runs/4",
    occurredAt: "2026-07-27T08:00:00.000Z",
    title: "CI",
    source: "GitHub",
    confidence: "fact",
    databaseId: 4,
    workflowName: "CI",
    runNumber: 4,
    event: "push",
    status: "completed",
    conclusion: "success",
    headBranch: "main",
    headSha: SHA,
    createdAt: "2026-07-27T08:00:00.000Z",
    updatedAt: "2026-07-27T08:05:00.000Z",
    runStartedAt: null,
  };
}

function makeActivity(
  overrides: Partial<PublicRepositoryActivity> = {},
): PublicRepositoryActivity {
  return {
    repository: { owner: "acme", repo: "rocket" },
    fetchedAt: "2026-07-27T12:05:00.000Z",
    categoryUrls: {
      commits: "https://github.com/acme/rocket/commits/main",
      pullRequests: "https://github.com/acme/rocket/pulls",
      issues: "https://github.com/acme/rocket/issues",
      releases: "https://github.com/acme/rocket/releases",
      workflowRuns: "https://github.com/acme/rocket/actions",
    },
    commits: available([commit()], 20, true),
    pullRequests: available([pull()]),
    issues: available([issue()]),
    releases: available([release(1, 1), release(2, 10), release(3, 20)], 10),
    workflowRuns: available([workflow()]),
    ...overrides,
  };
}

describe("RepositoryActivity", () => {
  it("renders every required activity heading and bounded-sample disclosure", () => {
    render(<RepositoryActivity activity={makeActivity()} />);
    for (const name of [
      "Public activity evidence",
      "Activity overview",
      "Unified recent timeline",
      "Deterministic sampled summaries",
      "Activity by source",
      "Recent commits",
      "Pull requests",
      "Standalone issues",
      "Published releases",
      "Workflow runs",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(
      screen.getByText(/not a complete repository history/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/requests only page 1/i)).toBeInTheDocument();
  });

  it("labels source records as Fact and arithmetic as Deterministic", () => {
    render(<RepositoryActivity activity={makeActivity()} />);
    expect(screen.getAllByText("Fact").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deterministic").length).toBeGreaterThan(0);
  });

  it("orders the timeline by occurred timestamp", () => {
    render(<RepositoryActivity activity={makeActivity()} />);
    const timeline = screen.getByRole("heading", {
      name: "Unified recent timeline",
    }).parentElement?.parentElement;
    const links = within(timeline as HTMLElement).getAllByRole("link");
    expect(links[0]).toHaveTextContent("Safe first line");
    expect(links[1]).toHaveTextContent("Evidence PR");
    expect(links[2]).toHaveTextContent("Evidence issue");
  });

  it("shows safe commit display fields without email or multiline body", () => {
    render(<RepositoryActivity activity={makeActivity()} />);
    expect(screen.getAllByText("Safe first line").length).toBeGreaterThan(0);
    expect(screen.getByText(/aaaaaaa · Fallback Author/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /@example\.com|multiline body/i,
    );
  });

  it("shows reliable PR, issue, release, and workflow states", () => {
    render(<RepositoryActivity activity={makeActivity()} />);
    expect(screen.getByText("merged")).toBeInTheDocument();
    expect(screen.getByText("reopened")).toBeInTheDocument();
    expect(screen.getByText("prerelease")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(
      screen.getByText(/1\/1 completed successful \(100%\)/i),
    ).toBeInTheDocument();
  });

  it("renders a distinct published-release empty state without a never-history claim", () => {
    render(
      <RepositoryActivity
        activity={makeActivity({ releases: available([], 10) })}
      />,
    );
    expect(screen.getByText("No published releases")).toBeInTheDocument();
    expect(
      screen.getByText(
        /does not prove the repository has never had this activity/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps successful sections when one source is partially unavailable", () => {
    render(
      <>
        <h1>acme / rocket</h1>
        <RepositoryActivity
          activity={makeActivity({
            issues: {
              status: "unavailable",
              reason: "rate-limited",
              retryAt: "2026-07-27T13:00:00.000Z",
            },
          })}
        />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "acme / rocket",
    );
    expect(screen.getAllByText(/rate limited/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Safe first line").length).toBeGreaterThan(0);
    expect(screen.getByText(/retry availability around/i)).toBeInTheDocument();
  });

  it("discloses malformed omissions and whether more may exist", () => {
    render(
      <RepositoryActivity
        activity={makeActivity({
          commits: available([commit()], 20, true, 2),
        })}
      />,
    );
    expect(
      screen.getByText(/more activity may exist on github/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 malformed records were omitted/i),
    ).toBeInTheDocument();
  });

  it("uses safe external-link attributes and descriptive names", () => {
    render(<RepositoryActivity activity={makeActivity()} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer noopener");
      expect(link).toHaveAttribute(
        "href",
        expect.stringMatching(/^https:\/\/github\.com\//),
      );
    }
    expect(
      screen.getByRole("link", { name: /view recent commits on github/i }),
    ).toBeInTheDocument();
  });

  it("contains responsive wrapping and no productivity, ranking, or quality claim", () => {
    const { container } = render(
      <RepositoryActivity activity={makeActivity()} />,
    );
    expect(container.querySelector(".sm\\:grid-cols-2")).toBeInTheDocument();
    expect(container.querySelector(".min-w-0")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /developer ranking|productivity score|code quality score|complete history of/i,
    );
  });
});
