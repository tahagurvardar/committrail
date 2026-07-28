import "server-only";

import { DraftingError } from "@/lib/drafting/errors";
import type {
  DraftProviderDescriptor,
  GroundedDraftProvider,
} from "@/lib/drafting/types";

export class DisabledDraftProvider implements GroundedDraftProvider {
  constructor(readonly descriptor: DraftProviderDescriptor) {}

  async generate(): Promise<never> {
    throw new DraftingError("DRAFT_PROVIDER_DISABLED");
  }
}
