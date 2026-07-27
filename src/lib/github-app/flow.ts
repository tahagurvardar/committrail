import "server-only";

import { redirect } from "next/navigation";
import { requireGitHubAppConfig } from "@/lib/github-app/config";
import { getInstallationMetadata } from "@/lib/github-app/client";
import { getPrisma } from "@/lib/db/prisma";
import {
  createPkce,
  encryptFlowSecret,
  generateHighEntropyState,
  hashState,
  stateMatches,
} from "@/lib/security/flow-crypto";

const TEN_MINUTES = 10 * 60 * 1000;

export async function beginInstallation(workspaceId: string, userId: string) {
  const config = requireGitHubAppConfig();
  const state = generateHighEntropyState();
  await getPrisma().gitHubConnectionAttempt.create({
    data: {
      workspaceId,
      initiatingUserId: userId,
      stage: "INSTALLATION",
      stateHash: hashState(state),
      expiresAt: new Date(Date.now() + TEN_MINUTES),
    },
  });
  redirect(
    `https://github.com/apps/${config.slug}/installations/new?state=${encodeURIComponent(state)}`,
  );
}

function parseInstallationId(value: string | null): bigint {
  if (!value || !/^\d{1,20}$/.test(value))
    throw new Error("GITHUB_APP_INVALID_CALLBACK");
  return BigInt(value);
}

export async function acceptSetupCallback(input: {
  state: string | null;
  installationId: string | null;
  userId: string;
  workspaceId: string;
}) {
  if (!input.state) throw new Error("GITHUB_APP_INVALID_CALLBACK");
  const prisma = getPrisma();
  const attempt = await prisma.gitHubConnectionAttempt.findUnique({
    where: { stateHash: hashState(input.state) },
  });
  if (
    !attempt ||
    attempt.stage !== "INSTALLATION" ||
    attempt.initiatingUserId !== input.userId ||
    attempt.workspaceId !== input.workspaceId ||
    attempt.consumedAt ||
    attempt.expiresAt <= new Date() ||
    !stateMatches(input.state, attempt.stateHash)
  )
    throw new Error("GITHUB_APP_INVALID_CALLBACK");

  const installationId = parseInstallationId(input.installationId);
  const metadata = await getInstallationMetadata(installationId);
  if (metadata.installationId !== installationId)
    throw new Error("GITHUB_APP_INVALID_CALLBACK");

  const oauthState = generateHighEntropyState();
  const pkce = createPkce();
  const authorizationAttempt = await prisma.$transaction(async (tx) => {
    const consumed = await tx.gitHubConnectionAttempt.updateMany({
      where: { id: attempt.id, consumedAt: null },
      data: { consumedAt: new Date(), pendingInstallationId: installationId },
    });
    if (consumed.count !== 1) throw new Error("GITHUB_APP_INVALID_CALLBACK");
    const id = crypto.randomUUID();
    return tx.gitHubConnectionAttempt.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        initiatingUserId: input.userId,
        stage: "AUTHORIZATION",
        stateHash: hashState(oauthState),
        pendingInstallationId: installationId,
        encryptedPkceVerifier: encryptFlowSecret(pkce.verifier, id),
        expiresAt: new Date(Date.now() + TEN_MINUTES),
      },
    });
  });
  const config = requireGitHubAppConfig();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set(
    "redirect_uri",
    `${config.baseUrl}/api/github/oauth/callback`,
  );
  authorize.searchParams.set("state", oauthState);
  authorize.searchParams.set("code_challenge", pkce.challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  return { url: authorize.toString(), attemptId: authorizationAttempt.id };
}
