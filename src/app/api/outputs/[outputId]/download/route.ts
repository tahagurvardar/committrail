import { getAuth } from "@/lib/auth/auth";
import { ensurePersonalWorkspace } from "@/lib/auth/workspace";
import { buildPrivateOutputDownload } from "@/lib/portfolio/output-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ outputId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  const workspace = await ensurePersonalWorkspace(session.user);
  const { outputId } = await context.params;
  const formatValue = new URL(request.url).searchParams.get("format");
  const format =
    formatValue === "md" || formatValue === "json" ? formatValue : "txt";
  try {
    const download = await buildPrivateOutputDownload(
      { workspaceId: workspace.id, userId: session.user.id },
      outputId,
      format,
    );
    return new Response(download.body, { headers: download.headers });
  } catch {
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
