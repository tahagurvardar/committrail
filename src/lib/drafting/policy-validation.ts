import { DraftingError } from "@/lib/drafting/errors";
import type {
  GroundedDraftOutput,
  GroundedEvidenceBundle,
} from "@/lib/drafting/types";

const PROHIBITED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:top|best)\s+developer\b/i, "DRAFT_POLICY_RANKING"],
  [/\bdeveloper\s+(?:score|ranking)\b/i, "DRAFT_POLICY_RANKING"],
  [
    /\b(?:senior|junior|staff|principal)\s+(?:developer|engineer)\b/i,
    "DRAFT_POLICY_SENIORITY",
  ],
  [/\bproductiv(?:e|ity)\b/i, "DRAFT_POLICY_PRODUCTIVITY"],
  [/\bhigh[- ]quality\s+code\b/i, "DRAFT_POLICY_QUALITY"],
  [/\bproduction[- ]ready\b/i, "DRAFT_POLICY_PRODUCTION_READY"],
  [/\benterprise[- ]ready\b/i, "DRAFT_POLICY_ENTERPRISE_READY"],
  [/\bfully\s+secure\b/i, "DRAFT_POLICY_SECURITY"],
  [/\bbug[- ]free\b/i, "DRAFT_POLICY_BUG_FREE"],
  [
    /\bcomplete\s+(?:repository\s+)?history\b/i,
    "DRAFT_POLICY_COMPLETE_HISTORY",
  ],
];

export function validateDraftPolicy(
  output: GroundedDraftOutput,
  bundle: GroundedEvidenceBundle,
): string[] {
  const warnings: string[] = [];
  const combined = [
    output.title ?? "",
    ...output.sentences.map((sentence) => sentence.text),
    ...output.caveats,
  ].join(" ");
  for (const [pattern, code] of PROHIBITED_PATTERNS) {
    if (pattern.test(combined)) throw new DraftingError(code);
  }
  const supportedNumbers = collectSupportedNumbers(bundle);
  const numericClaims = combined.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  for (const numeric of numericClaims) {
    const normalized = numeric.replace(/%$/, "");
    if (numeric.endsWith("%") || !supportedNumbers.has(normalized))
      throw new DraftingError("DRAFT_POLICY_UNSUPPORTED_NUMBER");
  }
  if (
    /\b(?:industry-leading|world-class|exceptional|unmatched)\b/i.test(combined)
  )
    warnings.push("PROMOTIONAL_WORDING_REQUIRES_REVIEW");
  return warnings;
}

function collectSupportedNumbers(bundle: GroundedEvidenceBundle): Set<string> {
  const values = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value))
      values.add(String(value));
    else if (typeof value === "string") {
      for (const match of value.match(/\b\d+(?:\.\d+)?\b/g) ?? [])
        values.add(match);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object")
      Object.values(value as Record<string, unknown>).forEach(visit);
  };
  bundle.evidence.forEach((evidence) => {
    visit(evidence.title);
    visit(evidence.occurredAt);
    visit(evidence.facts);
  });
  return values;
}
