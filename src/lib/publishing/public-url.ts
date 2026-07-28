import { normalizePublicUrl } from "./validation";

export function configuredPublicAppUrl(): string | null {
  try {
    const value = normalizePublicUrl(
      process.env.PUBLIC_APP_URL,
      "PUBLIC_APP_URL_INVALID",
    );
    if (!value) return null;
    const url = new URL(value);
    if (url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}
