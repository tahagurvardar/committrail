import { describe, expect, it } from "vitest";

import {
  activityPagination,
  linkHeaderHasSafeNext,
} from "@/lib/github/pagination";

describe("GitHub activity pagination metadata", () => {
  it("recognizes an exact next relation on the fixed GitHub API origin", () => {
    expect(
      linkHeaderHasSafeNext(
        '<https://api.github.com/repos/acme/rocket/commits?page=2>; rel="next", <https://api.github.com/repos/acme/rocket/commits?page=8>; rel="last"',
      ),
    ).toBe(true);
  });

  it("returns false when no next relation exists", () => {
    expect(
      linkHeaderHasSafeNext(
        '<https://api.github.com/repos/acme/rocket/commits?page=1>; rel="prev"',
      ),
    ).toBe(false);
  });

  it.each([
    ["malformed", "not a link"],
    ["arbitrary host", '<https://evil.example/steal?page=2>; rel="next"'],
    ["unsafe scheme", '<javascript:alert(1)>; rel="next"'],
    [
      "lookalike relation",
      '<https://api.github.com/repos/acme/rocket/commits?page=2>; rel="next-page"',
    ],
  ])("handles %s Link data safely", (_label, value) => {
    expect(linkHeaderHasSafeNext(value)).toBe(false);
  });

  it("normalizes only the disclosure fields and never exposes the upstream URL", () => {
    const headers = new Headers({
      link: '<https://api.github.com/repos/acme/rocket/commits?page=2&token=never>; rel="next"',
    });
    const pagination = activityPagination(headers, 20, 20);
    expect(pagination).toEqual({
      hasMore: true,
      returnedCount: 20,
      sampleLimit: 20,
    });
    expect(JSON.stringify(pagination)).not.toMatch(/api\.github|token|page=2/);
  });
});
