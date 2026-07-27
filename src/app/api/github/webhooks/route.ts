import { NextResponse } from "next/server";
import {
  requireWebhookSecret,
  WEBHOOK_BODY_LIMIT_BYTES,
} from "@/lib/webhooks/config";
import { payloadSha256, verifyWebhookSignature } from "@/lib/webhooks/security";
import { persistVerifiedWebhook } from "@/lib/webhooks/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELIVERY_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== "application/json")
    return response("Unsupported content type.", 415);

  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");
  if (!signature || !deliveryId || !event)
    return response("Required webhook headers are missing.", 400);
  if (!DELIVERY_ID.test(deliveryId) || !EVENT_NAME.test(event))
    return response("Webhook headers are invalid.", 400);

  let secret: string;
  try {
    secret = requireWebhookSecret();
  } catch {
    return response("Webhook processing is temporarily unavailable.", 503);
  }

  let body: Uint8Array;
  try {
    body = await readBoundedBody(request, WEBHOOK_BODY_LIMIT_BYTES);
  } catch (error) {
    return response(
      "Webhook payload is too large.",
      error instanceof Error && error.message === "WEBHOOK_BODY_TOO_LARGE"
        ? 413
        : 400,
    );
  }
  if (!verifyWebhookSignature(body, signature, secret))
    return response("Webhook verification failed.", 401);

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    );
  } catch {
    return response("Webhook payload is invalid.", 400);
  }

  try {
    const result = await persistVerifiedWebhook({
      githubDeliveryId: deliveryId,
      event,
      bodyByteCount: body.byteLength,
      payloadSha256: payloadSha256(body),
      parsedBody,
    });
    return NextResponse.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        ignored: result.ignored,
      },
      { status: result.duplicate ? 200 : 202, headers: NO_STORE },
    );
  } catch {
    return response("Webhook processing is temporarily unavailable.", 503);
  }
}

async function readBoundedBody(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maximumBytes)
    throw new Error("WEBHOOK_BODY_TOO_LARGE");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("WEBHOOK_BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function response(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: NO_STORE });
}
