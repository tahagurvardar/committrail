-- AlterEnum
ALTER TYPE "IngestionJobKind" ADD VALUE 'GROUNDED_DRAFT';

-- AlterEnum
ALTER TYPE "ClaimRevisionKind" ADD VALUE 'DRAFT_ACCEPTED';
ALTER TYPE "ClaimRevisionKind" ADD VALUE 'HUMAN_EDIT_AFTER_ACCEPTANCE';

-- CreateEnum
CREATE TYPE "ClaimOrigin" AS ENUM ('HUMAN', 'AI_ASSISTED');

-- CreateEnum
CREATE TYPE "DraftProviderKind" AS ENUM ('OPENAI_COMPATIBLE', 'FIXTURE');

-- CreateEnum
CREATE TYPE "DraftProviderClassification" AS ENUM ('LOCAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "DraftStyle" AS ENUM ('CONCISE', 'TECHNICAL', 'INTERVIEW');

-- CreateEnum
CREATE TYPE "DraftGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DraftGroundingStatus" AS ENUM ('VALID', 'INVALID', 'STALE');

-- CreateEnum
CREATE TYPE "DraftReviewStatus" AS ENUM ('READY', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'INVALID');

-- CreateEnum
CREATE TYPE "DraftReviewEventKind" AS ENUM (
    'GENERATION_QUEUED',
    'GENERATION_STARTED',
    'GENERATION_SUCCEEDED',
    'GENERATION_FAILED',
    'CANDIDATE_REJECTED',
    'CANDIDATE_ACCEPTED',
    'CLAIM_CREATED',
    'CLAIM_REPLACED',
    'HUMAN_EDITED',
    'CONSENT_GRANTED',
    'CONSENT_REVOKED'
);

-- AlterTable
ALTER TABLE "EvidenceClaim"
ADD COLUMN "origin" "ClaimOrigin" NOT NULL DEFAULT 'HUMAN',
ADD COLUMN "humanEditedAfterAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkspaceDraftingConsent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "consentVersion" INTEGER NOT NULL,
    "privacyPolicyVersion" INTEGER NOT NULL,
    "providerKind" "DraftProviderKind" NOT NULL,
    "providerClassification" "DraftProviderClassification" NOT NULL,
    "providerIdentityHash" TEXT NOT NULL,
    "acceptedByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDraftingConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftGenerationRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trackedRepositoryId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "ingestionJobId" TEXT,
    "regenerationOfId" TEXT,
    "providerKind" "DraftProviderKind" NOT NULL,
    "providerClassification" "DraftProviderClassification" NOT NULL,
    "providerIdentityHash" TEXT NOT NULL,
    "modelLabel" TEXT NOT NULL,
    "promptTemplateVersion" INTEGER NOT NULL,
    "evidenceBundleVersion" INTEGER NOT NULL,
    "evidenceBundleHash" TEXT NOT NULL,
    "draftingIntent" TEXT NOT NULL,
    "style" "DraftStyle" NOT NULL,
    "status" "DraftGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "requestHash" TEXT NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sanitizedErrorCode" TEXT,
    "inputEvidenceCount" INTEGER NOT NULL,
    "inputByteCount" INTEGER NOT NULL,
    "outputByteCount" INTEGER,
    "requestDurationMs" INTEGER,
    "inputTokenCount" INTEGER,
    "outputTokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftGenerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftGenerationEvidence" (
    "draftRequestId" TEXT NOT NULL,
    "repositoryEvidenceId" TEXT NOT NULL,
    "trackedRepositoryId" TEXT NOT NULL,
    "evidenceContentHash" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftGenerationEvidence_pkey" PRIMARY KEY ("draftRequestId", "repositoryEvidenceId", "trackedRepositoryId")
);

-- CreateTable
CREATE TABLE "DraftCandidate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "candidateVersion" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "combinedStatement" TEXT NOT NULL,
    "caveats" JSONB NOT NULL,
    "policyWarnings" JSONB NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'AI_ASSISTED_DRAFT',
    "groundingStatus" "DraftGroundingStatus" NOT NULL DEFAULT 'VALID',
    "reviewStatus" "DraftReviewStatus" NOT NULL DEFAULT 'READY',
    "sentenceCount" INTEGER NOT NULL,
    "citedSentenceCount" INTEGER NOT NULL,
    "uniqueEvidenceCount" INTEGER NOT NULL,
    "selectedEvidenceCount" INTEGER NOT NULL,
    "evidenceTypesUsed" JSONB NOT NULL,
    "unusedSelectedEvidenceCount" INTEGER NOT NULL,
    "acceptedClaimId" TEXT,
    "reviewedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftSentence" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "draftRequestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftSentence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftSentenceEvidence" (
    "draftSentenceId" TEXT NOT NULL,
    "draftRequestId" TEXT NOT NULL,
    "repositoryEvidenceId" TEXT NOT NULL,
    "trackedRepositoryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftSentenceEvidence_pkey" PRIMARY KEY ("draftSentenceId", "repositoryEvidenceId")
);

-- CreateTable
CREATE TABLE "DraftReviewEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "draftRequestId" TEXT,
    "candidateId" TEXT,
    "claimId" TEXT,
    "actorUserId" TEXT,
    "kind" "DraftReviewEventKind" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceDraftingConsent_workspaceId_consentVersion_privacy_idx"
ON "WorkspaceDraftingConsent"(
    "workspaceId",
    "consentVersion",
    "privacyPolicyVersion",
    "providerKind",
    "providerClassification",
    "providerIdentityHash"
);

-- Only one current consent applies to an exact provider identity and policy.
CREATE UNIQUE INDEX "WorkspaceDraftingConsent_active_provider_identity_key"
ON "WorkspaceDraftingConsent"(
    "workspaceId",
    "consentVersion",
    "privacyPolicyVersion",
    "providerKind",
    "providerClassification",
    "providerIdentityHash"
)
WHERE "revokedAt" IS NULL;

-- CreateIndex
CREATE INDEX "WorkspaceDraftingConsent_workspaceId_revokedAt_acceptedAt_idx"
ON "WorkspaceDraftingConsent"("workspaceId", "revokedAt", "acceptedAt");

-- CreateIndex
CREATE INDEX "WorkspaceDraftingConsent_acceptedByUserId_acceptedAt_idx"
ON "WorkspaceDraftingConsent"("acceptedByUserId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DraftGenerationRequest_ingestionJobId_key"
ON "DraftGenerationRequest"("ingestionJobId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftGenerationRequest_id_trackedRepositoryId_key"
ON "DraftGenerationRequest"("id", "trackedRepositoryId");

-- CreateIndex
CREATE INDEX "DraftGenerationRequest_workspaceId_trackedRepositoryId_status_createdAt_idx"
ON "DraftGenerationRequest"("workspaceId", "trackedRepositoryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DraftGenerationRequest_workspaceId_requestedByUserId_createdAt_idx"
ON "DraftGenerationRequest"("workspaceId", "requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftGenerationRequest_requestHash_status_idx"
ON "DraftGenerationRequest"("requestHash", "status");

-- CreateIndex
CREATE INDEX "DraftGenerationRequest_ingestionJobId_idx"
ON "DraftGenerationRequest"("ingestionJobId");

-- Only one active request may exist for an owner and repository.
CREATE UNIQUE INDEX "DraftGenerationRequest_active_owner_repository_key"
ON "DraftGenerationRequest"("workspaceId", "trackedRepositoryId", "requestedByUserId")
WHERE "status" IN ('QUEUED', 'RUNNING');

-- Equivalent active submissions are idempotent.
CREATE UNIQUE INDEX "DraftGenerationRequest_active_request_hash_key"
ON "DraftGenerationRequest"("requestHash")
WHERE "status" IN ('QUEUED', 'RUNNING');

-- CreateIndex
CREATE UNIQUE INDEX "DraftGenerationEvidence_draftRequestId_position_key"
ON "DraftGenerationEvidence"("draftRequestId", "position");

-- CreateIndex
CREATE INDEX "DraftGenerationEvidence_repositoryEvidenceId_idx"
ON "DraftGenerationEvidence"("repositoryEvidenceId");

-- CreateIndex
CREATE INDEX "DraftGenerationEvidence_trackedRepositoryId_idx"
ON "DraftGenerationEvidence"("trackedRepositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftCandidate_requestId_key" ON "DraftCandidate"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftCandidate_acceptedClaimId_key" ON "DraftCandidate"("acceptedClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftCandidate_id_requestId_key" ON "DraftCandidate"("id", "requestId");

-- CreateIndex
CREATE INDEX "DraftCandidate_reviewStatus_createdAt_idx" ON "DraftCandidate"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "DraftCandidate_groundingStatus_createdAt_idx" ON "DraftCandidate"("groundingStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DraftSentence_candidateId_position_key" ON "DraftSentence"("candidateId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DraftSentence_id_draftRequestId_key" ON "DraftSentence"("id", "draftRequestId");

-- CreateIndex
CREATE INDEX "DraftSentence_draftRequestId_idx" ON "DraftSentence"("draftRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftSentenceEvidence_draftSentenceId_position_key"
ON "DraftSentenceEvidence"("draftSentenceId", "position");

-- CreateIndex
CREATE INDEX "DraftSentenceEvidence_draftRequestId_repositoryEvidenceId_trackedRepositoryId_idx"
ON "DraftSentenceEvidence"("draftRequestId", "repositoryEvidenceId", "trackedRepositoryId");

-- CreateIndex
CREATE INDEX "DraftReviewEvent_workspaceId_createdAt_idx" ON "DraftReviewEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftReviewEvent_draftRequestId_createdAt_idx" ON "DraftReviewEvent"("draftRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftReviewEvent_candidateId_createdAt_idx" ON "DraftReviewEvent"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftReviewEvent_claimId_createdAt_idx" ON "DraftReviewEvent"("claimId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftReviewEvent_actorUserId_createdAt_idx" ON "DraftReviewEvent"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceDraftingConsent"
ADD CONSTRAINT "WorkspaceDraftingConsent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDraftingConsent"
ADD CONSTRAINT "WorkspaceDraftingConsent_acceptedByUserId_fkey"
FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGenerationRequest"
ADD CONSTRAINT "DraftGenerationRequest_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGenerationRequest"
ADD CONSTRAINT "DraftGenerationRequest_trackedRepositoryId_fkey"
FOREIGN KEY ("trackedRepositoryId") REFERENCES "TrackedRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGenerationRequest"
ADD CONSTRAINT "DraftGenerationRequest_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGenerationRequest"
ADD CONSTRAINT "DraftGenerationRequest_ingestionJobId_fkey"
FOREIGN KEY ("ingestionJobId") REFERENCES "IngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGenerationRequest"
ADD CONSTRAINT "DraftGenerationRequest_regenerationOfId_fkey"
FOREIGN KEY ("regenerationOfId") REFERENCES "DraftGenerationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGenerationEvidence"
ADD CONSTRAINT "DraftGenerationEvidence_draftRequestId_trackedRepositoryId_fkey"
FOREIGN KEY ("draftRequestId", "trackedRepositoryId")
REFERENCES "DraftGenerationRequest"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGenerationEvidence"
ADD CONSTRAINT "DraftGenerationEvidence_repositoryEvidenceId_trackedRepositoryId_fkey"
FOREIGN KEY ("repositoryEvidenceId", "trackedRepositoryId")
REFERENCES "RepositoryEvidence"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftCandidate"
ADD CONSTRAINT "DraftCandidate_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "DraftGenerationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftCandidate"
ADD CONSTRAINT "DraftCandidate_acceptedClaimId_fkey"
FOREIGN KEY ("acceptedClaimId") REFERENCES "EvidenceClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftCandidate"
ADD CONSTRAINT "DraftCandidate_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftSentence"
ADD CONSTRAINT "DraftSentence_candidateId_draftRequestId_fkey"
FOREIGN KEY ("candidateId", "draftRequestId")
REFERENCES "DraftCandidate"("id", "requestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftSentenceEvidence"
ADD CONSTRAINT "DraftSentenceEvidence_draftSentenceId_draftRequestId_fkey"
FOREIGN KEY ("draftSentenceId", "draftRequestId")
REFERENCES "DraftSentence"("id", "draftRequestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftSentenceEvidence"
ADD CONSTRAINT "DraftSentenceEvidence_draftRequestId_repositoryEvidenceId_trackedRepositoryId_fkey"
FOREIGN KEY ("draftRequestId", "repositoryEvidenceId", "trackedRepositoryId")
REFERENCES "DraftGenerationEvidence"("draftRequestId", "repositoryEvidenceId", "trackedRepositoryId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReviewEvent"
ADD CONSTRAINT "DraftReviewEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReviewEvent"
ADD CONSTRAINT "DraftReviewEvent_draftRequestId_fkey"
FOREIGN KEY ("draftRequestId") REFERENCES "DraftGenerationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReviewEvent"
ADD CONSTRAINT "DraftReviewEvent_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "DraftCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReviewEvent"
ADD CONSTRAINT "DraftReviewEvent_claimId_fkey"
FOREIGN KEY ("claimId") REFERENCES "EvidenceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReviewEvent"
ADD CONSTRAINT "DraftReviewEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
