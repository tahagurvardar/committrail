import "server-only";

import { getDraftProviderConfig } from "@/lib/drafting/config";
import { DisabledDraftProvider } from "@/lib/drafting/disabled-provider";
import { OpenAICompatibleDraftProvider } from "@/lib/drafting/openai-compatible-provider";
import type { GroundedDraftProvider } from "@/lib/drafting/types";

export function getGroundedDraftProvider(): GroundedDraftProvider {
  const config = getDraftProviderConfig();
  return config.mode === "disabled"
    ? new DisabledDraftProvider(config.descriptor)
    : new OpenAICompatibleDraftProvider(config);
}

export function getGroundedDraftProviderDescriptor() {
  return getDraftProviderConfig().descriptor;
}
