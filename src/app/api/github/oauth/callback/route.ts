import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/auth";
import { ensurePersonalWorkspace } from "@/lib/auth/workspace";
import {
  exchangeOAuthCode,
  getInstallationMetadata,
  listUserInstallationIds,
} from "@/lib/github-app/client";
import { getPrisma } from "@/lib/db/prisma";
import {
  decryptFlowSecret,
  hashState,
  stateMatches,
} from "@/lib/security/flow-crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return NextResponse.redirect(
      new URL("/login?returnTo=/dashboard/github", request.url),
    );
  const destination = new URL(
    "/dashboard/github?status=connection-error",
    request.url,
  );
  try {
    const workspace = await ensurePersonalWorkspace(session.user);
    const params = new URL(request.url).searchParams;
    const state = params.get("state");
    const code = params.get("code");
    if (!state || !code || params.get("error"))
      throw new Error("GITHUB_APP_INVALID_CALLBACK");
    const prisma = getPrisma();
    const attempt = await prisma.gitHubConnectionAttempt.findUnique({
      where: { stateHash: hashState(state) },
    });
    if (
      !attempt ||
      attempt.stage !== "AUTHORIZATION" ||
      attempt.workspaceId !== workspace.id ||
      attempt.initiatingUserId !== session.user.id ||
      attempt.consumedAt ||
      attempt.expiresAt <= new Date() ||
      !attempt.pendingInstallationId ||
      !attempt.encryptedPkceVerifier ||
      !stateMatches(state, attempt.stateHash)
    )
      throw new Error("GITHUB_APP_INVALID_CALLBACK");

    const verifier = decryptFlowSecret(
      attempt.encryptedPkceVerifier,
      attempt.id,
    );
    const userToken = await exchangeOAuthCode(code, verifier);
    const allowed = await listUserInstallationIds(userToken);
    const installationId = attempt.pendingInstallationId;
    if (!allowed.has(installationId.toString()))
      throw new Error("GITHUB_APP_INSTALLATION_NOT_AUTHORIZED");
    const metadata = await getInstallationMetadata(installationId);

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.gitHubConnectionAttempt.updateMany({
        where: { id: attempt.id, consumedAt: null },
        data: { consumedAt: new Date(), encryptedPkceVerifier: null },
      });
      if (consumed.count !== 1) throw new Error("GITHUB_APP_INVALID_CALLBACK");
      const owned = await tx.gitHubInstallation.findUnique({
        where: { installationId },
      });
      if (owned && owned.workspaceId !== workspace.id)
        throw new Error("GITHUB_APP_INSTALLATION_NOT_AUTHORIZED");
      await tx.gitHubInstallation.upsert({
        where: { installationId },
        update: {
          accountId: metadata.accountId,
          accountLogin: metadata.accountLogin,
          accountType: metadata.accountType,
          repositorySelection: metadata.repositorySelection,
          permissions: metadata.permissions,
          suspendedAt: metadata.suspendedAt,
          verifiedAt: new Date(),
        },
        create: {
          workspaceId: workspace.id,
          installationId,
          accountId: metadata.accountId,
          accountLogin: metadata.accountLogin,
          accountType: metadata.accountType,
          repositorySelection: metadata.repositorySelection,
          permissions: metadata.permissions,
          suspendedAt: metadata.suspendedAt,
          verifiedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: workspace.id,
          userId: session.user.id,
          type: "github.connection.verified",
        },
      });
    });
    destination.search = "?status=connected";
  } catch {
    // Visitor-facing status is deliberately generic; secrets and upstream bodies never enter the URL.
  }
  return NextResponse.redirect(destination, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
