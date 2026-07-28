import { describe, expect, it } from "vitest";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  SECURITY_HEADER_NAMES,
} from "./security-headers";

describe("security headers", () => {
  it("builds an active nonce policy without arbitrary script execution", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "release-nonce",
      production: true,
    });
    expect(policy).toContain("script-src 'self' 'nonce-release-nonce'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("'unsafe-inline' 'unsafe-eval'");
  });

  it("sets every baseline header and gates HSTS on production HTTPS", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, {
      nonce: "release-nonce",
      production: true,
      https: true,
    });
    for (const name of SECURITY_HEADER_NAMES)
      expect(headers.has(name)).toBe(true);
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("does not advertise HSTS over local HTTP", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, {
      nonce: "release-nonce",
      production: false,
      https: false,
    });
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("keeps framework development scripts executable without relaxing inline scripts", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "development-nonce",
      production: false,
    });
    expect(policy).toContain(
      "script-src 'self' 'nonce-development-nonce' 'unsafe-eval'",
    );
    expect(policy).not.toContain("'strict-dynamic'");
    expect(policy.match(/script-src[^;]+/)?.[0]).not.toContain(
      "'unsafe-inline'",
    );
  });
});
