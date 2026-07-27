import "server-only";

export interface GitHubAppConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  slug: string;
  privateKey: string;
  baseUrl: string;
}

export function getGitHubAppConfig(): GitHubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  const privateKeyValue = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  const baseUrl = process.env.BETTER_AUTH_URL?.trim();
  if (
    !appId ||
    !clientId ||
    !clientSecret ||
    !slug ||
    !privateKeyValue ||
    !baseUrl
  )
    return null;
  if (!/^\d+$/.test(appId) || !/^[A-Za-z0-9-]+$/.test(slug)) return null;
  const privateKey = privateKeyValue.replaceAll("\\n", "\n");
  if (!privateKey.includes("BEGIN PRIVATE KEY")) return null;
  return { appId, clientId, clientSecret, slug, privateKey, baseUrl };
}

export function requireGitHubAppConfig(): GitHubAppConfig {
  const config = getGitHubAppConfig();
  if (!config) throw new Error("GITHUB_APP_CONFIGURATION_UNAVAILABLE");
  return config;
}
