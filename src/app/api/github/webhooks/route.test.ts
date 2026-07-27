import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistMock } = vi.hoisted(() => ({
  persistMock: vi.fn(),
}));

vi.mock("@/lib/webhooks/persistence", () => ({
  persistVerifiedWebhook: persistMock,
}));

import { POST } from "@/app/api/github/webhooks/route";

const secret = "deterministic-webhook-secret-at-least-32-bytes";

function request(
  body: string,
  options?: {
    signature?: string | null;
    delivery?: string | null;
    event?: string | null;
    contentType?: string;
    contentLength?: string;
  },
) {
  const signature =
    options?.signature === undefined
      ? `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
      : options.signature;
  const headers = new Headers({
    "content-type": options?.contentType ?? "application/json; charset=utf-8",
  });
  if (signature !== null) headers.set("x-hub-signature-256", signature);
  if (options?.delivery !== null)
    headers.set("x-github-delivery", options?.delivery ?? "delivery-123");
  if (options?.event !== null)
    headers.set("x-github-event", options?.event ?? "ping");
  if (options?.contentLength)
    headers.set("content-length", options.contentLength);
  return new Request("http://localhost/api/github/webhooks", {
    method: "POST",
    headers,
    body,
  });
}

describe("GitHub webhook route", () => {
  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    persistMock.mockReset();
    persistMock.mockResolvedValue({
      duplicate: false,
      ignored: true,
      deliveryId: "delivery-row",
    });
  });

  it("accepts a valid exact-byte signature only after durable persistence", async () => {
    const body = '{"zen":"Keep it logically awesome."}';
    const response = await POST(request(body));
    expect(response.status).toBe(202);
    expect(persistMock).toHaveBeenCalledWith(
      expect.objectContaining({
        githubDeliveryId: "delivery-123",
        event: "ping",
        bodyByteCount: Buffer.byteLength(body),
        parsedBody: { zen: "Keep it logically awesome." },
      }),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects a modified body with a signature for different bytes", async () => {
    const original = '{"action":"opened"}';
    const signature = `sha256=${createHmac("sha256", secret)
      .update(original)
      .digest("hex")}`;
    const response = await POST(
      request('{ "action": "opened" }', { signature }),
    );
    expect(response.status).toBe(401);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing signature", { signature: null }, 400],
    ["missing delivery", { delivery: null }, 400],
    ["missing event", { event: null }, 400],
    ["malformed signature", { signature: "sha256=abc" }, 401],
    ["invalid delivery", { delivery: "../secret" }, 400],
    ["invalid event", { event: "Pull Request" }, 400],
  ] as const)("rejects %s", async (_name, options, status) => {
    expect((await POST(request("{}", options))).status).toBe(status);
  });

  it("rejects unsupported content types", async () => {
    expect(
      (await POST(request("{}", { contentType: "text/plain" }))).status,
    ).toBe(415);
  });

  it("rejects an oversized declared payload before parsing", async () => {
    expect(
      (
        await POST(
          request("{}", {
            contentLength: String(25 * 1024 * 1024 + 1),
          }),
        )
      ).status,
    ).toBe(413);
  });

  it("fails safely when the secret is missing", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    expect((await POST(request("{}"))).status).toBe(503);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("parses JSON only after valid signature verification", async () => {
    const invalidJson = "{";
    expect((await POST(request(invalidJson))).status).toBe(400);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("returns an idempotent 200 for duplicate delivery", async () => {
    persistMock.mockResolvedValue({
      duplicate: true,
      ignored: false,
      deliveryId: "delivery-row",
    });
    const response = await POST(request("{}"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accepted: true,
      duplicate: true,
    });
  });

  it("never passes signature, secret, cookies, or authorization to persistence", async () => {
    const incoming = request("{}", { event: "ping" });
    incoming.headers.set("cookie", "session=private");
    incoming.headers.set("authorization", "Bearer private");
    await POST(incoming);
    const serialized = JSON.stringify(persistMock.mock.calls[0][0]);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("session=private");
    expect(serialized).not.toContain("Bearer private");
    expect(serialized).not.toContain("sha256=");
  });

  it("returns 503 when the transaction cannot enqueue", async () => {
    persistMock.mockRejectedValue(new Error("database unavailable"));
    expect((await POST(request("{}"))).status).toBe(503);
  });
});
