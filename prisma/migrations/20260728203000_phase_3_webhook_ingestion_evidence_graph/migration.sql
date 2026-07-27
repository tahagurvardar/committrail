-- AlterEnum
ALTER TYPE "TrackingStatus" ADD VALUE 'INACCESSIBLE';

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'QUEUED', 'IGNORED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionJobKind" AS ENUM ('REPOSITORY_METADATA', 'COMMITS', 'PULL_REQUESTS', 'ISSUES', 'RELEASES', 'WORKFLOW_RUNS', 'INSTALLATION_STATE', 'INSTALLATION_REPOSITORIES');

-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ObservationSourceKind" AS ENUM ('MANUAL_SYNC', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "EvidenceSourceAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'DELETED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'NEEDS_EVIDENCE', 'VERIFIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClaimRevisionKind" AS ENUM ('CREATED', 'STATEMENT_EDITED', 'STATUS_CHANGED', 'EVIDENCE_LINKED', 'EVIDENCE_UNLINKED', 'VERIFIED', 'ARCHIVED', 'RESTORED');

-- AlterTable
ALTER TABLE "RepositoryEvidence"
ADD COLUMN "normalizedContentHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sourceAvailability" "EvidenceSourceAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN "sourceUnavailableAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trackedRepositoryId" TEXT,
    "githubInstallationId" TEXT,
    "kind" "IngestionJobKind" NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'PENDING',
    "deduplicationKey" TEXT NOT NULL,
    "minimalPayload" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maximumAttempts" INTEGER NOT NULL DEFAULT 5,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sanitizedLastErrorCode" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "githubDeliveryId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "githubInstallationId" TEXT,
    "trackedRepositoryId" TEXT,
    "ingestionJobId" TEXT,
    "jobGeneration" INTEGER NOT NULL DEFAULT 0,
    "eventName" TEXT NOT NULL,
    "action" TEXT,
    "installationId" BIGINT,
    "githubRepositoryId" BIGINT,
    "payloadSha256" TEXT NOT NULL,
    "bodyByteCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "ignoredReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "sanitizedErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceObservation" (
    "id" TEXT NOT NULL,
    "repositoryEvidenceId" TEXT NOT NULL,
    "sourceKind" "ObservationSourceKind" NOT NULL,
    "syncRunId" TEXT,
    "webhookDeliveryId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "normalizedContentHash" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryIngestionCursor" (
    "id" TEXT NOT NULL,
    "trackedRepositoryId" TEXT NOT NULL,
    "sourceKind" "IngestionJobKind" NOT NULL,
    "lastSuccessfulAt" TIMESTAMP(3),
    "lastObservedSourceAt" TIMESTAMP(3),
    "etag" TEXT,
    "lastModified" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryIngestionCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceClaim" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trackedRepositoryId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'NEEDS_EVIDENCE',
    "verifiedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidence" (
    "claimId" TEXT NOT NULL,
    "repositoryEvidenceId" TEXT NOT NULL,
    "trackedRepositoryId" TEXT NOT NULL,
    "linkedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("claimId","repositoryEvidenceId")
);

-- CreateTable
CREATE TABLE "ClaimRevision" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "kind" "ClaimRevisionKind" NOT NULL,
    "statementSnapshot" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL,
    "evidenceIdSnapshot" TEXT,
    "changeSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepositoryEvidence_trackedRepositoryId_evidenceType_sourceAvailability_idx" ON "RepositoryEvidence"("trackedRepositoryId", "evidenceType", "sourceAvailability");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryEvidence_id_trackedRepositoryId_key" ON "RepositoryEvidence"("id", "trackedRepositoryId");

-- CreateIndex
CREATE INDEX "IngestionJob_status_availableAt_idx" ON "IngestionJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "IngestionJob_trackedRepositoryId_status_idx" ON "IngestionJob"("trackedRepositoryId", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_githubInstallationId_status_idx" ON "IngestionJob"("githubInstallationId", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_workspaceId_createdAt_idx" ON "IngestionJob"("workspaceId", "createdAt");

-- Partial unique index: at most one active source job per repository/installation.
CREATE UNIQUE INDEX "IngestionJob_active_deduplicationKey_key"
ON "IngestionJob"("deduplicationKey")
WHERE "status" IN ('PENDING', 'RUNNING');

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_githubDeliveryId_key" ON "WebhookDelivery"("githubDeliveryId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_receivedAt_idx" ON "WebhookDelivery"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_trackedRepositoryId_receivedAt_idx" ON "WebhookDelivery"("trackedRepositoryId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_githubInstallationId_receivedAt_idx" ON "WebhookDelivery"("githubInstallationId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_installationId_receivedAt_idx" ON "WebhookDelivery"("installationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceObservation_deduplicationKey_key" ON "EvidenceObservation"("deduplicationKey");

-- CreateIndex
CREATE INDEX "EvidenceObservation_repositoryEvidenceId_observedAt_idx" ON "EvidenceObservation"("repositoryEvidenceId", "observedAt");

-- CreateIndex
CREATE INDEX "EvidenceObservation_webhookDeliveryId_idx" ON "EvidenceObservation"("webhookDeliveryId");

-- CreateIndex
CREATE INDEX "EvidenceObservation_syncRunId_idx" ON "EvidenceObservation"("syncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryIngestionCursor_trackedRepositoryId_sourceKind_key" ON "RepositoryIngestionCursor"("trackedRepositoryId", "sourceKind");

-- CreateIndex
CREATE INDEX "RepositoryIngestionCursor_lastSuccessfulAt_idx" ON "RepositoryIngestionCursor"("lastSuccessfulAt");

-- CreateIndex
CREATE INDEX "EvidenceClaim_workspaceId_trackedRepositoryId_status_idx" ON "EvidenceClaim"("workspaceId", "trackedRepositoryId", "status");

-- CreateIndex
CREATE INDEX "EvidenceClaim_authorUserId_updatedAt_idx" ON "EvidenceClaim"("authorUserId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceClaim_id_trackedRepositoryId_key" ON "EvidenceClaim"("id", "trackedRepositoryId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_repositoryEvidenceId_idx" ON "ClaimEvidence"("repositoryEvidenceId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_linkedByUserId_idx" ON "ClaimEvidence"("linkedByUserId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_trackedRepositoryId_idx" ON "ClaimEvidence"("trackedRepositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimRevision_claimId_revisionNumber_key" ON "ClaimRevision"("claimId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ClaimRevision_actorUserId_createdAt_idx" ON "ClaimRevision"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_trackedRepositoryId_fkey" FOREIGN KEY ("trackedRepositoryId") REFERENCES "TrackedRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_githubInstallationId_fkey" FOREIGN KEY ("githubInstallationId") REFERENCES "GitHubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_githubInstallationId_fkey" FOREIGN KEY ("githubInstallationId") REFERENCES "GitHubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_trackedRepositoryId_fkey" FOREIGN KEY ("trackedRepositoryId") REFERENCES "TrackedRepository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_ingestionJobId_fkey" FOREIGN KEY ("ingestionJobId") REFERENCES "IngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObservation" ADD CONSTRAINT "EvidenceObservation_repositoryEvidenceId_fkey" FOREIGN KEY ("repositoryEvidenceId") REFERENCES "RepositoryEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObservation" ADD CONSTRAINT "EvidenceObservation_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "RepositorySyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObservation" ADD CONSTRAINT "EvidenceObservation_webhookDeliveryId_fkey" FOREIGN KEY ("webhookDeliveryId") REFERENCES "WebhookDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryIngestionCursor" ADD CONSTRAINT "RepositoryIngestionCursor_trackedRepositoryId_fkey" FOREIGN KEY ("trackedRepositoryId") REFERENCES "TrackedRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_trackedRepositoryId_fkey" FOREIGN KEY ("trackedRepositoryId") REFERENCES "TrackedRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claimId_trackedRepositoryId_fkey" FOREIGN KEY ("claimId", "trackedRepositoryId") REFERENCES "EvidenceClaim"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_repositoryEvidenceId_trackedRepositoryId_fkey" FOREIGN KEY ("repositoryEvidenceId", "trackedRepositoryId") REFERENCES "RepositoryEvidence"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRevision" ADD CONSTRAINT "ClaimRevision_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "EvidenceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRevision" ADD CONSTRAINT "ClaimRevision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
