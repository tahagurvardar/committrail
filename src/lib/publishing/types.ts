import type {
  ClaimOrigin,
  EvidenceDisclosureMode,
  PublicationHealthState,
  PublicationVisibility,
  RepositoryDisclosurePolicy,
} from "@/generated/prisma/client";

export interface PublicEvidenceView {
  identifier: string;
  type: string;
  title: string;
  occurredAt: string | null;
  disclosureMode: EvidenceDisclosureMode;
  sourceUrl: string | null;
  provenance: string;
  confidence: "FACT";
}

export interface PublicClaimView {
  identifier: string;
  statement: string;
  origin: ClaimOrigin;
  verifiedAt: string;
  humanEdited: boolean;
  aiAssistedDisclosure: string | null;
  evidence: PublicEvidenceView[];
}

export interface PublicProjectView {
  schemaVersion: 1;
  slug: string;
  title: string;
  summary: string;
  role: string;
  period: string | null;
  technologies: string[];
  problem: string | null;
  approach: string | null;
  outcome: string | null;
  repositoryDisclosurePolicy: RepositoryDisclosurePolicy;
  publicRepositoryLabel: string | null;
  publicRepositoryUrl: string | null;
  visibility: PublicationVisibility;
  author: {
    slug: string;
    displayName: string;
    headline: string;
    biography: string;
    location: string | null;
    personalWebsiteUrl: string | null;
    githubProfileUrl: string | null;
  };
  claims: PublicClaimView[];
  publishedAt: string;
  revisionNumber: number;
  contentHash: string;
  health: PublicationHealthState;
  healthNotice: string | null;
}

export interface PublicationDraftInput {
  trackedRepositoryId: string;
  slug: unknown;
  internalTitle: unknown;
  title: unknown;
  summary: unknown;
  roleText: unknown;
  projectPeriodText?: unknown;
  technologyLabels?: unknown;
  problemText?: unknown;
  approachText?: unknown;
  outcomeText?: unknown;
  repositoryDisclosurePolicy: unknown;
  visibility: unknown;
  claims: Array<{
    claimId: string;
    evidence: Array<{
      repositoryEvidenceId: string;
      mode: unknown;
      publicTitle?: unknown;
      includeOccurredAt?: boolean;
    }>;
  }>;
}

export interface PublishConfirmation {
  expectedVersion: unknown;
  confirmation: unknown;
  publicDisclosureAcknowledged: unknown;
  privateSourceAcknowledged: unknown;
  idempotencyKey: unknown;
}
