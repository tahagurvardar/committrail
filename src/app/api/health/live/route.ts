import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "live", version: APP_VERSION },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
