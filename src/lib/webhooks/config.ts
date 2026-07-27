import "server-only";

export const WEBHOOK_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

export function getWebhookConfiguration(): {
  configured: boolean;
  bodyLimitBytes: number;
} {
  const value = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  return {
    configured: Boolean(value && Buffer.byteLength(value, "utf8") >= 32),
    bodyLimitBytes: WEBHOOK_BODY_LIMIT_BYTES,
  };
}

export function requireWebhookSecret(): string {
  const value = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("WEBHOOK_CONFIGURATION_UNAVAILABLE");
  }
  return value;
}
