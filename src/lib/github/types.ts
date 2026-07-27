/**
 * Product-owned domain types for the Phase 1 public repository snapshot.
 *
 * Raw GitHub payload shapes stop at the provider boundary
 * (map-github-response.ts); everything the UI touches is defined here.
 */

/** A validated, normalized reference to a public GitHub repository. */
export interface RepositoryIdentifier {
  owner: string;
  repo: string;
}

/** One language's share of the repository's reported language bytes. */
export interface LanguageShare {
  name: string;
  bytes: number;
  /** Whole-repository share in percent, rounded to one decimal. */
  percent: number;
}

export interface ReadmeInfo {
  present: boolean;
  /** Path inside the repository, e.g. "README.md". */
  path: string | null;
  /** Canonical HTTPS GitHub page for the README. */
  htmlUrl: string | null;
  /** Length-limited plain-text excerpt; null when unavailable. */
  excerpt: string | null;
  /** True when the excerpt was cut short of the full document. */
  truncated: boolean;
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  /** ISO timestamp when the current rate-limit window resets. */
  resetAt: string | null;
}

export interface RepositoryLicense {
  name: string;
  spdxId: string | null;
}

export interface PublicRepositorySnapshot {
  identity: {
    /** Owner login exactly as reported by the GitHub API. */
    owner: string;
    /** Repository name exactly as reported by the GitHub API. */
    name: string;
    fullName: string;
    /** Canonical HTTPS GitHub repository URL. */
    url: string;
  };
  description: string | null;
  ownerAvatarUrl: string | null;
  /** Always false in Phase 1 — private repositories are never shown. */
  isPrivate: boolean;
  defaultBranch: string;
  archived: boolean;
  fork: boolean;
  isTemplate: boolean | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  subscribers: number | null;
  license: RepositoryLicense | null;
  topics: string[];
  primaryLanguage: string | null;
  languages: LanguageShare[];
  /** Validated http(s) homepage URL, or null. */
  homepage: string | null;
  readme: ReadmeInfo;
  /** ISO timestamp of when this snapshot was generated. */
  fetchedAt: string;
  rateLimit: RateLimitInfo | null;
}
