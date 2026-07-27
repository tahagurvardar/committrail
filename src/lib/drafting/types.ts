export const DRAFT_EVIDENCE_BUNDLE_VERSION = 1;
export const DRAFT_PROMPT_TEMPLATE_VERSION = 1;
export const DRAFT_CONSENT_VERSION = 1;
export const DRAFT_PRIVACY_POLICY_VERSION = 1;
export const DRAFT_MAX_EVIDENCE_COUNT = 12;
export const DRAFT_DEFAULT_MAX_INPUT_BYTES = 64 * 1024;
export const DRAFT_DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024;
export const DRAFT_DEFAULT_TIMEOUT_MS = 30_000;

export type DraftProviderKind = "OPENAI_COMPATIBLE" | "FIXTURE";
export type DraftProviderClassification = "LOCAL" | "EXTERNAL";
export type GroundedDraftStyle = "CONCISE" | "TECHNICAL" | "INTERVIEW";

export interface DraftProviderDescriptor {
  kind: DraftProviderKind;
  classification: DraftProviderClassification;
  modelLabel: string;
  configured: boolean;
  providerIdentityHash: string;
  maximumEvidenceCount: number;
  maximumRequestBytes: number;
  maximumOutputBytes: number;
  selectedEvidenceLeavesProcess: boolean;
}

export interface GroundedEvidenceItem {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  sourceUrl: string;
  confidence: string;
  contentHash: string;
  facts: Record<string, unknown>;
}

export interface GroundedEvidenceBundle {
  schemaVersion: number;
  evidence: GroundedEvidenceItem[];
  orderedEvidenceIds: string[];
  contentHashes: string[];
}

export interface BuiltEvidenceBundle {
  bundle: GroundedEvidenceBundle;
  hash: string;
  byteSize: number;
}

export interface GroundedDraftProviderRequest {
  intent: string;
  style: GroundedDraftStyle;
  evidenceBundle: GroundedEvidenceBundle;
}

export interface GroundedDraftProviderContext {
  requestId: string;
  signal?: AbortSignal;
}

export interface DraftProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface GroundedDraftProviderResponse {
  content: string;
  byteSize: number;
  usage?: DraftProviderUsage;
}

export interface GroundedDraftProvider {
  readonly descriptor: DraftProviderDescriptor;
  generate(
    request: GroundedDraftProviderRequest,
    context: GroundedDraftProviderContext,
  ): Promise<GroundedDraftProviderResponse>;
}

export interface GroundedDraftSentence {
  text: string;
  evidenceIds: string[];
}

export interface GroundedDraftOutput {
  title?: string;
  sentences: GroundedDraftSentence[];
  caveats: string[];
}

export interface GroundingCoverage {
  sentenceCount: number;
  citedSentenceCount: number;
  uniqueEvidenceCount: number;
  selectedEvidenceCount: number;
  evidenceTypesUsed: string[];
  unusedSelectedEvidenceCount: number;
}
