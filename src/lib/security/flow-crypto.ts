import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function generateHighEntropyState(): string {
  return randomBytes(32).toString("base64url");
}

export function hashState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

export function stateMatches(state: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashState(state), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function encryptionKey(value = process.env.APP_ENCRYPTION_KEY): Buffer {
  if (!value) throw new Error("GITHUB_APP_CONFIGURATION_UNAVAILABLE");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error("GITHUB_APP_CONFIGURATION_UNAVAILABLE");
  return key;
}

export function encryptFlowSecret(
  secret: string,
  associatedData: string,
): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptFlowSecret(
  envelope: string,
  associatedData: string,
): string {
  const [version, nonceValue, encryptedValue, tagValue] = envelope.split(".");
  if (version !== "v1" || !nonceValue || !encryptedValue || !tagValue) {
    throw new Error("INVALID_PROTECTED_FLOW_MATERIAL");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(nonceValue, "base64url"),
    );
    decipher.setAAD(Buffer.from(associatedData));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("INVALID_PROTECTED_FLOW_MATERIAL");
  }
}

export function createPkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
