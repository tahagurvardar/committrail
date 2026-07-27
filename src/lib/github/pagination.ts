import type { ActivityPagination } from "@/lib/github/activity-types";

const GITHUB_API_HOST = "api.github.com";

export function activityPagination(
  headers: Headers,
  returnedCount: number,
  sampleLimit: number,
): ActivityPagination {
  return {
    hasMore: linkHeaderHasSafeNext(headers.get("link")),
    returnedCount,
    sampleLimit,
  };
}

export function linkHeaderHasSafeNext(value: string | null): boolean {
  if (value === null || value.length > 8_192) {
    return false;
  }
  for (const part of value.split(",")) {
    const match = part.trim().match(/^<([^<>\s]+)>\s*(?:;\s*[^,]+)*$/);
    const relation = part.match(/;\s*rel\s*=\s*"([^"]*)"/i)?.[1];
    if (
      !match ||
      relation === undefined ||
      !relation
        .trim()
        .split(/\s+/)
        .some((token) => token.toLowerCase() === "next")
    ) {
      continue;
    }
    try {
      const url = new URL(match[1]);
      if (
        url.protocol === "https:" &&
        url.hostname.toLowerCase() === GITHUB_API_HOST &&
        url.port === "" &&
        url.username === "" &&
        url.password === ""
      ) {
        return true;
      }
    } catch {
      // Malformed pagination metadata is safely treated as absent.
    }
  }
  return false;
}
