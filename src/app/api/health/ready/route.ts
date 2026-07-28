import { getPrisma } from "@/lib/db/prisma";
import { isPublicDemo } from "@/lib/config/app-mode";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

const READINESS_TIMEOUT_MS = 1_500;

export async function GET() {
  const configured = configurationSummary();
  if (isPublicDemo()) {
    return response(200, {
      status: "ready",
      version: APP_VERSION,
      configured,
    });
  }
  try {
    await databaseProbe();
    return response(200, {
      status: "ready",
      version: APP_VERSION,
      configured,
    });
  } catch {
    return response(503, {
      status: "not-ready",
      version: APP_VERSION,
      configured,
    });
  }
}

function databaseProbe(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("READINESS_TIMEOUT")),
      READINESS_TIMEOUT_MS,
    );
    try {
      Promise.resolve(getPrisma().$queryRaw`SELECT 1`).then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function configurationSummary() {
  return {
    worker: Boolean(process.env.DATABASE_URL),
    githubApp: Boolean(
      process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_CLIENT_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY,
    ),
    webhook: (process.env.GITHUB_WEBHOOK_SECRET?.length ?? 0) >= 32,
    drafting: process.env.DRAFT_PROVIDER === "openai-compatible",
  };
}

function response(status: number, body: object) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
