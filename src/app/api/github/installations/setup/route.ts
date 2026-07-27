import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/auth";
import { ensurePersonalWorkspace } from "@/lib/auth/workspace";
import { acceptSetupCallback } from "@/lib/github-app/flow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return NextResponse.redirect(
      new URL("/login?returnTo=/dashboard/github", request.url),
    );
  try {
    const workspace = await ensurePersonalWorkspace(session.user);
    const params = new URL(request.url).searchParams;
    if (params.get("setup_action") === "delete")
      throw new Error("GITHUB_APP_INVALID_CALLBACK");
    const result = await acceptSetupCallback({
      state: params.get("state"),
      installationId: params.get("installation_id"),
      userId: session.user.id,
      workspaceId: workspace.id,
    });
    return NextResponse.redirect(result.url, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/github?status=connection-error", request.url),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
