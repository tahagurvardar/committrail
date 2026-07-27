/**
 * The product constraints CommitTrail commits to publicly.
 * Rendered on the landing page and the about page, and asserted in tests —
 * changing this copy is a product decision, not a styling tweak.
 */
export interface TrustPrinciple {
  id: string;
  title: string;
  body: string;
}

export const TRUST_PRINCIPLES: readonly TrustPrinciple[] = [
  {
    id: "read-only",
    title: "Read-only by design",
    body: "CommitTrail will only ever request read access to GitHub. It cannot modify repositories, open pull requests, or write anything back — and it never will.",
  },
  {
    id: "evidence-first",
    title: "Evidence before interpretation",
    body: "Facts are collected and pinned first. Narrative is drafted only on top of recorded evidence, and every claim stays linked back to the records that support it.",
  },
  {
    id: "user-approval",
    title: "User approval before publication",
    body: "Nothing goes public without explicit review. Drafts — including AI-assisted ones — stay private until the author verifies and approves them.",
  },
  {
    id: "no-ranking",
    title: "No developer ranking",
    body: "CommitTrail never scores, ranks, or compares developers, never infers seniority, and never treats commit counts as a measure of productivity.",
  },
  {
    id: "no-execution",
    title: "No code execution",
    body: "Repository contents are read as evidence, never run. CommitTrail does not build, execute, or evaluate your code.",
  },
];
