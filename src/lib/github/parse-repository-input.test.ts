import { describe, expect, it } from "vitest";

import {
  MAX_REPOSITORY_INPUT_LENGTH,
  parseRepositoryInput,
  validateRepositoryIdentifier,
} from "@/lib/github/parse-repository-input";

function expectOk(input: string, owner: string, repo: string) {
  const result = parseRepositoryInput(input);
  expect(result.ok, `expected ok for ${JSON.stringify(input)}`).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual({ owner, repo });
  }
}

function expectError(input: string, code: string) {
  const result = parseRepositoryInput(input);
  expect(result.ok, `expected error for ${JSON.stringify(input)}`).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
    expect(result.error.message.length).toBeGreaterThan(0);
  }
}

describe("parseRepositoryInput — accepted forms", () => {
  it("parses owner/repository", () => {
    expectOk("vercel/next.js", "vercel", "next.js");
  });

  it("parses a full https GitHub URL", () => {
    expectOk("https://github.com/vercel/next.js", "vercel", "next.js");
  });

  it("tolerates a trailing slash", () => {
    expectOk("https://github.com/vercel/next.js/", "vercel", "next.js");
  });

  it("strips a .git suffix", () => {
    expectOk("https://github.com/vercel/next.js.git", "vercel", "next.js");
    expectOk("vercel/next.js.git", "vercel", "next.js");
  });

  it("trims surrounding whitespace", () => {
    expectOk("  vercel/next.js  ", "vercel", "next.js");
  });

  it("normalizes a mixed-case GitHub hostname", () => {
    expectOk("https://GitHub.COM/vercel/next.js", "vercel", "next.js");
  });

  it("accepts www.github.com and scheme-less pastes", () => {
    expectOk("https://www.github.com/vercel/next.js", "vercel", "next.js");
    expectOk("github.com/vercel/next.js", "vercel", "next.js");
  });

  it("preserves the typed case of owner and repository", () => {
    expectOk("OpenAI/Whisper-Test", "OpenAI", "Whisper-Test");
  });
});

describe("parseRepositoryInput — rejected forms", () => {
  it("rejects empty and whitespace-only input", () => {
    expectError("", "empty");
    expectError("   ", "empty");
  });

  it("rejects excessive length", () => {
    expectError("a".repeat(MAX_REPOSITORY_INPUT_LENGTH + 1), "too-long");
  });

  it("rejects a missing repository", () => {
    expectError("vercel", "missing-repository");
    expectError("https://github.com/vercel", "missing-repository");
    expectError("vercel/.git", "missing-repository");
  });

  it("rejects extra path segments", () => {
    expectError(
      "https://github.com/vercel/next.js/tree/main",
      "extra-path-segments",
    );
    expectError("vercel/next.js/issues", "extra-path-segments");
  });

  it("rejects non-GitHub hosts", () => {
    expectError("https://gitlab.com/owner/repo", "unsupported-host");
    expectError(
      "https://github.com.evil.example/owner/repo",
      "unsupported-host",
    );
    expectError("https://api.github.com/repos/owner/repo", "unsupported-host");
  });

  it("rejects unsupported schemes", () => {
    expectError("http://github.com/owner/repo", "unsupported-scheme");
    expectError("javascript:alert(1)", "unsupported-scheme");
    expectError("ftp://github.com/owner/repo", "unsupported-scheme");
    expectError("data:text/html,hello", "unsupported-scheme");
  });

  it("rejects credentials and ports", () => {
    expectError(
      "https://user:pass@github.com/owner/repo",
      "credentials-not-allowed",
    );
    expectError("https://github.com:8443/owner/repo", "port-not-allowed");
    expectError("git@github.com:owner/repo.git", "credentials-not-allowed");
  });

  it("rejects query strings and fragments", () => {
    expectError(
      "https://github.com/owner/repo?tab=readme",
      "query-or-fragment",
    );
    expectError("https://github.com/owner/repo#readme", "query-or-fragment");
    expectError("https://github.com/owner/repo?", "query-or-fragment");
    expectError("https://github.com/owner/repo#", "query-or-fragment");
  });

  it("rejects invalid owner names", () => {
    expectError("-leading/repo", "invalid-owner");
    expectError("trailing-/repo", "invalid-owner");
    expectError("dou--ble/repo", "invalid-owner");
    expectError("own er/repo", "invalid-owner");
  });

  it("rejects invalid repository names", () => {
    expectError("owner/re po", "invalid-repository");
    expectError("owner/..", "invalid-repository");
    expectError("owner/re$po", "invalid-repository");
  });

  it("rejects traversal-like and encoded suspicious inputs", () => {
    expectError("https://github.com/../../etc/passwd", "not-recognized");
    expectError("https://github.com/owner/%2e%2e/repository", "not-recognized");
    expectError("https://github.com/%2e%2e/etc/passwd", "not-recognized");
    expectError("https://github.com/owner%2Frepository", "not-recognized");
    expectError("owner/%2e%2e", "invalid-repository");
    expectError("https://github.com/owner/repo%2Fextra", "not-recognized");
  });

  it("rejects doubled slashes", () => {
    expectError("owner//repo", "not-recognized");
    expectError("https://github.com/owner//repo", "not-recognized");
  });

  it("rejects backslash ambiguity before URL normalization", () => {
    expectError("https://github.com/owner\\repo", "not-recognized");
    expectError(
      "https://github.com\\@evil.example/owner/repo",
      "not-recognized",
    );
  });

  it("rejects control characters before URL normalization", () => {
    expectError("https://github.com/own\ter/repo", "not-recognized");
    expectError("https://github.com/owner/\nrepo", "not-recognized");
  });
});

describe("validateRepositoryIdentifier", () => {
  it("accepts already-normalized values", () => {
    expect(validateRepositoryIdentifier("vercel", "next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("returns null for anything outside the strict grammar", () => {
    expect(validateRepositoryIdentifier("bad owner", "repo")).toBeNull();
    expect(validateRepositoryIdentifier("owner", "bad repo")).toBeNull();
    expect(validateRepositoryIdentifier("owner", "..")).toBeNull();
  });
});
