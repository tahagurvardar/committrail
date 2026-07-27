import "server-only";

import { importPKCS8, SignJWT } from "jose";
import type { GitHubAppConfig } from "@/lib/github-app/config";

export async function createGitHubAppJwt(
  config: GitHubAppConfig,
  now = new Date(),
): Promise<string> {
  let key: CryptoKey;
  try {
    key = await importPKCS8(config.privateKey, "RS256");
  } catch {
    throw new Error("GITHUB_APP_CONFIGURATION_UNAVAILABLE");
  }
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 9 * 60)
    .setIssuer(config.appId)
    .sign(key);
}
