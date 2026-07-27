// @vitest-environment node

import { generateKeyPairSync } from "node:crypto";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";
import { createGitHubAppJwt } from "@/lib/github-app/jwt";

describe("GitHub App JWT", () => {
  it("uses RS256, the app issuer, skew, and a short expiry", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = await createGitHubAppJwt(
      {
        appId: "12345",
        clientId: "fixture",
        clientSecret: "fixture",
        slug: "fixture",
        privateKey: privateKey
          .export({ type: "pkcs8", format: "pem" })
          .toString(),
        baseUrl: "http://localhost:3000",
      },
      new Date("2026-07-27T12:00:00Z"),
    );
    const payload = decodeJwt(token);
    expect(decodeProtectedHeader(token).alg).toBe("RS256");
    expect(payload.iss).toBe("12345");
    expect(payload.exp! - payload.iat!).toBe(540);
    expect(token).not.toHaveLength(40);
  });
});
