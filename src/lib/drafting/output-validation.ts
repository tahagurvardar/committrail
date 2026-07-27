import { DraftingError } from "@/lib/drafting/errors";
import type {
  GroundedDraftOutput,
  GroundingCoverage,
  GroundedEvidenceBundle,
} from "@/lib/drafting/types";
import { validateDraftPolicy } from "@/lib/drafting/policy-validation";

export interface ValidatedDraftOutput {
  output: GroundedDraftOutput;
  combinedStatement: string;
  coverage: GroundingCoverage;
  policyWarnings: string[];
}

export function validateGroundedDraftOutput(
  raw: string,
  bundle: GroundedEvidenceBundle,
  maximumOutputBytes: number,
): ValidatedDraftOutput {
  if (Buffer.byteLength(raw, "utf8") > maximumOutputBytes)
    throw new DraftingError("DRAFT_OUTPUT_TOO_LARGE");
  if (raw.trimStart().startsWith("```"))
    throw new DraftingError("DRAFT_OUTPUT_CODE_FENCE");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new DraftingError("DRAFT_OUTPUT_INVALID_JSON");
  }
  const record = strictRecord(value, ["title", "sentences", "caveats"]);
  const title =
    record.title === undefined
      ? undefined
      : validatedText(record.title, 120, "DRAFT_OUTPUT_INVALID_TITLE");
  if (!Array.isArray(record.sentences))
    throw new DraftingError("DRAFT_OUTPUT_INVALID_SENTENCES");
  if (record.sentences.length < 1 || record.sentences.length > 4)
    throw new DraftingError("DRAFT_OUTPUT_INVALID_SENTENCE_COUNT");
  const selected = new Set(bundle.orderedEvidenceIds);
  const sentences = record.sentences.map((value) => {
    const sentence = strictRecord(value, ["text", "evidenceIds"]);
    const text = validatedText(
      sentence.text,
      300,
      "DRAFT_OUTPUT_INVALID_SENTENCE",
    );
    if (!Array.isArray(sentence.evidenceIds) || !sentence.evidenceIds.length)
      throw new DraftingError("DRAFT_OUTPUT_MISSING_CITATION");
    if (
      sentence.evidenceIds.some((id): boolean => typeof id !== "string") ||
      new Set(sentence.evidenceIds).size !== sentence.evidenceIds.length
    )
      throw new DraftingError("DRAFT_OUTPUT_INVALID_CITATION");
    const evidenceIds = sentence.evidenceIds as string[];
    if (evidenceIds.some((id) => !selected.has(id)))
      throw new DraftingError("DRAFT_OUTPUT_UNKNOWN_CITATION");
    return { text, evidenceIds };
  });
  const combinedStatement = sentences
    .map((sentence) => sentence.text)
    .join(" ");
  if (combinedStatement.length > 500)
    throw new DraftingError("DRAFT_OUTPUT_COMBINED_TOO_LONG");
  if (!Array.isArray(record.caveats) || record.caveats.length > 5)
    throw new DraftingError("DRAFT_OUTPUT_INVALID_CAVEATS");
  const caveats = record.caveats.map((caveat) =>
    validatedText(caveat, 200, "DRAFT_OUTPUT_INVALID_CAVEAT"),
  );
  const output = {
    ...(title ? { title } : {}),
    sentences,
    caveats,
  };
  const policyWarnings = validateDraftPolicy(output, bundle);
  const usedIds = new Set(
    sentences.flatMap((sentence) => sentence.evidenceIds),
  );
  const usedTypes = new Set(
    bundle.evidence
      .filter((item) => usedIds.has(item.id))
      .map((item) => item.type),
  );
  return {
    output,
    combinedStatement,
    policyWarnings,
    coverage: {
      sentenceCount: sentences.length,
      citedSentenceCount: sentences.length,
      uniqueEvidenceCount: usedIds.size,
      selectedEvidenceCount: bundle.evidence.length,
      evidenceTypesUsed: [...usedTypes].sort(),
      unusedSelectedEvidenceCount: bundle.evidence.length - usedIds.size,
    },
  };
}

function strictRecord(
  value: unknown,
  allowedKeys: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DraftingError("DRAFT_OUTPUT_INVALID_SHAPE");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedKeys.includes(key)))
    throw new DraftingError("DRAFT_OUTPUT_UNEXPECTED_FIELD");
  return record;
}

function validatedText(value: unknown, maximum: number, code: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum)
    throw new DraftingError(code);
  if (
    /[\u0000-\u001f\u007f]/.test(value) ||
    /<[^>]*>/.test(value) ||
    /```|`[^`]+`|!\[[^\]]*\]\(|\[[^\]]+\]\(|^(?:#{1,6}|>|[-+*]\s)|(?:\*\*|__)[^*_]+(?:\*\*|__)|\b(?:https?|ftp):\/\/|\bmailto:|www\./i.test(
      value,
    )
  )
    throw new DraftingError(code);
  const trimmed = value.trim();
  if (!trimmed) throw new DraftingError(code);
  return trimmed;
}
