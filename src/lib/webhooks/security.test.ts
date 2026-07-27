import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { payloadSha256, verifyWebhookSignature } from "@/lib/webhooks/security";

describe("webhook signature security", () => {
  const secret = "It's a Secret to Everybody";

  it("matches GitHub's documented HMAC-SHA256 vector", () => {
    expect(
      verifyWebhookSignature(
        new TextEncoder().encode("Hello, World!"),
        "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
        secret,
      ),
    ).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(
      verifyWebhookSignature(
        new TextEncoder().encode("Hello, World!"),
        `sha256=${"0".repeat(64)}`,
        secret,
      ),
    ).toBe(false);
  });

  it.each([
    "",
    "sha1=abc",
    "sha256=abc",
    `SHA256=${"0".repeat(64)}`,
    `sha256=${"g".repeat(64)}`,
  ])(
    "rejects malformed signature %s through the safe comparison path",
    (value) => {
      expect(
        verifyWebhookSignature(new TextEncoder().encode("{}"), value, secret),
      ).toBe(false);
    },
  );

  it("verifies exact raw bytes and rejects modified whitespace", () => {
    const original = new TextEncoder().encode('{"action":"opened"}');
    const modified = new TextEncoder().encode('{ "action": "opened" }');
    const signature = `sha256=${createHmac("sha256", secret)
      .update(original)
      .digest("hex")}`;
    expect(verifyWebhookSignature(original, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(modified, signature, secret)).toBe(false);
  });

  it("creates a deterministic payload digest", () => {
    expect(payloadSha256(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
