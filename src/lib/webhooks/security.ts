import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/;

export function payloadSha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function verifyWebhookSignature(
  body: Uint8Array,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(body).digest();
  const match = SIGNATURE_PATTERN.exec(signature);
  const supplied = match
    ? Buffer.from(match[1], "hex")
    : Buffer.alloc(expected.byteLength);
  const equal = timingSafeEqual(expected, supplied);
  return match !== null && equal;
}
