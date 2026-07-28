import "server-only";

import { createHash } from "node:crypto";
import type {
  GroundedDraftProvider,
  GroundedDraftProviderRequest,
  GroundedDraftProviderResponse,
} from "@/lib/drafting/types";

export class FixtureDraftProvider implements GroundedDraftProvider {
  readonly descriptor = {
    kind: "FIXTURE" as const,
    classification: "LOCAL" as const,
    modelLabel: "Deterministic test fixture",
    configured: true,
    providerIdentityHash: createHash("sha256")
      .update("committrail-test-fixture-v1")
      .digest("hex"),
    maximumEvidenceCount: 12,
    maximumRequestBytes: 64 * 1024,
    maximumOutputBytes: 16 * 1024,
    selectedEvidenceLeavesProcess: false,
  };

  constructor(
    private readonly responseFactory?: (
      request: GroundedDraftProviderRequest,
    ) => string,
  ) {}

  async generate(
    request: GroundedDraftProviderRequest,
  ): Promise<GroundedDraftProviderResponse> {
    if (process.env.NODE_ENV === "production")
      throw new Error("DRAFT_FIXTURE_BLOCKED_IN_PRODUCTION");
    const first = request.evidenceBundle.evidence[0];
    const content =
      this.responseFactory?.(request) ??
      JSON.stringify({
        title: "Grounded suggestion",
        sentences: [
          {
            text: first.title,
            evidenceIds: [first.id],
          },
        ],
        caveats: ["Review the wording against the cited evidence."],
      });
    return { content, byteSize: Buffer.byteLength(content, "utf8") };
  }
}
