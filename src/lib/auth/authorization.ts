import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/auth";
import { ensurePersonalWorkspace } from "@/lib/auth/workspace";
import { getPrisma } from "@/lib/db/prisma";
import { safeReturnPath } from "@/lib/auth/safe-return-path";

export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireSession(returnTo = "/dashboard") {
  const session = await getSession();
  if (!session)
    redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
  return session;
}

export async function requirePersonalWorkspace() {
  const session = await requireSession();
  const workspace = await ensurePersonalWorkspace(session.user);
  return { session, workspace };
}

export async function requireWorkspaceOwner() {
  const context = await requirePersonalWorkspace();
  const member = await getPrisma().workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: context.workspace.id,
        userId: context.session.user.id,
      },
    },
  });
  if (!member || member.role !== "OWNER") notFound();
  return context;
}

export async function getAuthorizedTrackedRepository(id: string) {
  const { workspace, session } = await requirePersonalWorkspace();
  const repository = await getPrisma().trackedRepository.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      installation: true,
      snapshot: true,
      evidence: { orderBy: { occurredAt: "desc" }, take: 30 },
      syncRuns: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!repository) notFound();
  return { repository, workspace, session };
}

export async function getAuthorizedInstallation(id: string) {
  const { workspace, session } = await requirePersonalWorkspace();
  const installation = await getPrisma().gitHubInstallation.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!installation) notFound();
  return { installation, workspace, session };
}
