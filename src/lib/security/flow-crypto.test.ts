import { beforeEach, describe, expect, it } from "vitest";
import {
  createPkce,
  decryptFlowSecret,
  encryptFlowSecret,
  generateHighEntropyState,
  hashState,
  stateMatches,
} from "@/lib/security/flow-crypto";

describe("connection flow cryptography", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("generates high-entropy URL-safe state", () => {
    const first = generateHighEntropyState();
    const second = generateHighEntropyState();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes and compares state without storing the raw value", () => {
    const state = generateHighEntropyState();
    const hash = hashState(state);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(state);
    expect(stateMatches(state, hash)).toBe(true);
    expect(stateMatches(`${state}x`, hash)).toBe(false);
  });

  it("encrypts with unique nonces and authenticated associated data", () => {
    const first = encryptFlowSecret("verifier", "attempt-1");
    const second = encryptFlowSecret("verifier", "attempt-1");
    expect(first).not.toBe(second);
    expect(decryptFlowSecret(first, "attempt-1")).toBe("verifier");
    expect(() => decryptFlowSecret(first, "attempt-2")).toThrow(
      "INVALID_PROTECTED_FLOW_MATERIAL",
    );
  });

  it("rejects tampered ciphertext without revealing the secret", () => {
    const encrypted = encryptFlowSecret("never-log-this", "attempt");
    expect(() => decryptFlowSecret(`${encrypted}x`, "attempt")).toThrow(
      "INVALID_PROTECTED_FLOW_MATERIAL",
    );
  });

  it("rejects invalid key lengths", () => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptFlowSecret("secret", "attempt")).toThrow(
      "GITHUB_APP_CONFIGURATION_UNAVAILABLE",
    );
  });

  it("creates a standards-shaped PKCE verifier and S256 challenge", () => {
    const pkce = createPkce();
    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.challenge).not.toBe(pkce.verifier);
  });
});
