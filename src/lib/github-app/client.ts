import "server-only";

import { createGitHubAppJwt } from "@/lib/github-app/jwt";
import { requireGitHubAppConfig } from "@/lib/github-app/config";
import { GITHUB_API_VERSION } from "@/lib/github/github-rest-client";

const API = "https://api.github.com";
const MAX_BODY_BYTES = 2 * 1024 * 1024;

type RequestOptions = {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
};

async function githubRequest(path: string, options: RequestOptions = {}) {
  const method = options.method ?? "GET";
  const allowed =
    /^\/app\/installations\/\d+$/.test(path) ||
    /^\/app\/installations\/\d+\/access_tokens$/.test(path) ||
    /^\/user\/installations(?:\?.*)?$/.test(path) ||
    /^\/installation\/repositories(?:\?.*)?$/.test(path);
  if (!allowed || (method === "POST" && !/\/access_tokens$/.test(path))) {
    throw new Error("GITHUB_APP_UNSUPPORTED_ENDPOINT");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "CommitTrail",
        Authorization: `Bearer ${options.token ?? ""}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_BODY_BYTES)
      throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES)
      throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
    if (!response.ok) {
      if (response.status === 403 || response.status === 429)
        throw new Error("GITHUB_APP_RATE_LIMITED");
      if (response.status === 404) throw new Error("GITHUB_APP_NOT_FOUND");
      throw new Error("GITHUB_APP_UPSTREAM_UNAVAILABLE");
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("GITHUB_APP_TIMEOUT");
    throw error instanceof Error && error.message.startsWith("GITHUB_APP_")
      ? error
      : new Error("GITHUB_APP_UPSTREAM_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
  return value as Record<string, unknown>;
}

function positiveBigInt(value: unknown): bigint {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^\d+$/.test(String(value))
  ) {
    throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
  }
  return BigInt(String(value));
}

export interface VerifiedInstallationMetadata {
  installationId: bigint;
  accountId: bigint;
  accountLogin: string;
  accountType: string;
  repositorySelection: "ALL" | "SELECTED";
  permissions: Record<string, string>;
  suspendedAt: Date | null;
}

export async function getInstallationMetadata(installationId: bigint) {
  const config = requireGitHubAppConfig();
  const appJwt = await createGitHubAppJwt(config);
  const value = record(
    await githubRequest(`/app/installations/${installationId}`, {
      token: appJwt,
    }),
  );
  const account = record(value.account);
  const login = account.login;
  const type = account.type;
  if (typeof login !== "string" || typeof type !== "string")
    throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
  const selection = value.repository_selection;
  if (selection !== "all" && selection !== "selected")
    throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
  const permissions = record(value.permissions);
  const safePermissions: Record<string, string> = {};
  for (const [key, permission] of Object.entries(permissions)) {
    if (typeof permission === "string" && /^(read|write)$/.test(permission))
      safePermissions[key] = permission;
  }
  return {
    installationId: positiveBigInt(value.id),
    accountId: positiveBigInt(account.id),
    accountLogin: login.slice(0, 100),
    accountType: type.slice(0, 30),
    repositorySelection: selection.toUpperCase() as "ALL" | "SELECTED",
    permissions: safePermissions,
    suspendedAt:
      typeof value.suspended_at === "string"
        ? new Date(value.suspended_at)
        : null,
  } satisfies VerifiedInstallationMetadata;
}

export async function createInstallationToken(
  installationId: bigint,
  repositoryId?: bigint,
) {
  const config = requireGitHubAppConfig();
  const appJwt = await createGitHubAppJwt(config);
  const value = record(
    await githubRequest(`/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      token: appJwt,
      body: {
        ...(repositoryId && repositoryId <= BigInt(Number.MAX_SAFE_INTEGER)
          ? { repository_ids: [Number(repositoryId)] }
          : {}),
      },
    }),
  );
  if (typeof value.token !== "string" || value.token.length < 10)
    throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
  return value.token;
}

export interface InstallationRepository {
  id: bigint;
  owner: string;
  name: string;
  fullName: string;
  visibility: "public" | "private" | "internal";
  defaultBranch: string;
  archived: boolean;
  fork: boolean;
  url: string;
}

function mapRepository(value: unknown): InstallationRepository | null {
  try {
    const item = record(value);
    const owner = record(item.owner);
    if (
      typeof owner.login !== "string" ||
      typeof item.name !== "string" ||
      typeof item.full_name !== "string" ||
      typeof item.default_branch !== "string" ||
      typeof item.archived !== "boolean" ||
      typeof item.fork !== "boolean" ||
      typeof item.html_url !== "string"
    )
      return null;
    const url = new URL(item.html_url);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const visibility = item.visibility;
    if (
      visibility !== "public" &&
      visibility !== "private" &&
      visibility !== "internal"
    )
      return null;
    return {
      id: positiveBigInt(item.id),
      owner: owner.login.slice(0, 100),
      name: item.name.slice(0, 100),
      fullName: item.full_name.slice(0, 201),
      visibility,
      defaultBranch: item.default_branch.slice(0, 255),
      archived: item.archived,
      fork: item.fork,
      url: url.toString(),
    };
  } catch {
    return null;
  }
}

export async function discoverInstallationRepositories(
  installationId: bigint,
  page = 1,
) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10)
    throw new Error("GITHUB_APP_INVALID_INPUT");
  const token = await createInstallationToken(installationId);
  const value = record(
    await githubRequest(
      `/installation/repositories?per_page=100&page=${page}`,
      { token },
    ),
  );
  if (!Array.isArray(value.repositories))
    throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
  const repositories = value.repositories
    .map(mapRepository)
    .filter((item): item is InstallationRepository => item !== null);
  return {
    repositories,
    discardedRecordCount: value.repositories.length - repositories.length,
    hasMore: value.repositories.length === 100,
  };
}

export async function listUserInstallationIds(userToken: string) {
  const value = record(
    await githubRequest("/user/installations?per_page=100&page=1", {
      token: userToken,
    }),
  );
  if (!Array.isArray(value.installations))
    throw new Error("GITHUB_APP_MALFORMED_RESPONSE");
  return new Set(
    value.installations.map((item) =>
      positiveBigInt(record(item).id).toString(),
    ),
  );
}

export async function exchangeOAuthCode(code: string, verifier: string) {
  const config = requireGitHubAppConfig();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "CommitTrail",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${config.baseUrl}/api/github/oauth/callback`,
      code_verifier: verifier,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("GITHUB_APP_OAUTH_FAILED");
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > 64 * 1024)
    throw new Error("GITHUB_APP_OAUTH_FAILED");
  const text = await response.text();
  if (Buffer.byteLength(text) > 64 * 1024)
    throw new Error("GITHUB_APP_OAUTH_FAILED");
  let value: Record<string, unknown>;
  try {
    value = record(JSON.parse(text));
  } catch {
    throw new Error("GITHUB_APP_OAUTH_FAILED");
  }
  if (typeof value.access_token !== "string")
    throw new Error("GITHUB_APP_OAUTH_FAILED");
  return value.access_token;
}
