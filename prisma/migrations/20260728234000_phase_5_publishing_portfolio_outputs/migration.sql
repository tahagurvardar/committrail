CREATE TYPE "PublicProfileVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
CREATE TYPE "PublicSlugKind" AS ENUM ('PROFILE', 'PROJECT');
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');
CREATE TYPE "PublicationVisibility" AS ENUM ('PUBLIC', 'UNLISTED');
CREATE TYPE "RepositoryDisclosurePolicy" AS ENUM ('PUBLIC_REPOSITORY', 'IDENTITY_REDACTED');
CREATE TYPE "EvidenceDisclosureMode" AS ENUM ('PUBLIC_SOURCE', 'SUMMARY_ONLY', 'PRIVATE_SOURCE_REDACTED');
CREATE TYPE "PublicationEventKind" AS ENUM (
  'DRAFT_CREATED',
  'PREVIEWED',
  'PUBLISHED',
  'REVISION_PUBLISHED',
  'UNPUBLISHED',
  'REPUBLISHED',
  'ARCHIVED',
  'RESTORED',
  'VISIBILITY_CHANGED',
  'EVIDENCE_BECAME_STALE',
  'PROFILE_HIDDEN',
  'REPOSITORY_DISCONNECTED',
  'ACCOUNT_DELETED'
);
CREATE TYPE "PublicationHealthState" AS ENUM ('CURRENT', 'REVIEW_REQUIRED', 'SOURCE_UNAVAILABLE');
CREATE TYPE "PortfolioOutputType" AS ENUM ('CASE_STUDY', 'CV_BULLETS', 'INTERVIEW_STORY');
CREATE TYPE "PortfolioOutputStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

CREATE TABLE "PublicProfile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "biography" TEXT NOT NULL,
  "locationText" TEXT,
  "personalWebsiteUrl" TEXT,
  "githubProfileUrl" TEXT,
  "visibility" "PublicProfileVisibility" NOT NULL DEFAULT 'PRIVATE',
  "firstPublishedAt" TIMESTAMP(3),
  "latestPublishedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicSlugReservation" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "kind" "PublicSlugKind" NOT NULL,
  "reservedByWorkspaceHash" TEXT NOT NULL,
  "firstReservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicSlugReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectPublication" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "trackedRepositoryId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "internalTitle" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "roleText" TEXT NOT NULL,
  "projectPeriodText" TEXT,
  "technologyLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "problemText" TEXT,
  "approachText" TEXT,
  "outcomeText" TEXT,
  "repositoryDisclosurePolicy" "RepositoryDisclosurePolicy" NOT NULL,
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "PublicationVisibility" NOT NULL DEFAULT 'UNLISTED',
  "currentPublishedRevisionId" TEXT,
  "lastPublishIdempotencyKey" TEXT,
  "firstPublishedAt" TIMESTAMP(3),
  "latestPublishedAt" TIMESTAMP(3),
  "unpublishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "healthState" "PublicationHealthState" NOT NULL DEFAULT 'CURRENT',
  "healthCheckedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationClaimSelection" (
  "publicationId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "trackedRepositoryId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "selectedStatementHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationClaimSelection_pkey" PRIMARY KEY ("publicationId", "claimId")
);

CREATE TABLE "PublicationEvidenceDisclosure" (
  "publicationId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "repositoryEvidenceId" TEXT NOT NULL,
  "trackedRepositoryId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "mode" "EvidenceDisclosureMode" NOT NULL,
  "publicTitle" TEXT,
  "includeOccurredAt" BOOLEAN NOT NULL DEFAULT true,
  "sourceContentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationEvidenceDisclosure_pkey" PRIMARY KEY ("publicationId", "claimId", "repositoryEvidenceId")
);

CREATE TABLE "ProjectPublicationRevision" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "roleText" TEXT NOT NULL,
  "projectPeriodText" TEXT,
  "technologyLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "problemText" TEXT,
  "approachText" TEXT,
  "outcomeText" TEXT,
  "repositoryDisclosurePolicy" "RepositoryDisclosurePolicy" NOT NULL,
  "publicRepositoryLabel" TEXT,
  "publicRepositoryUrl" TEXT,
  "authorSlug" TEXT NOT NULL,
  "authorDisplayName" TEXT NOT NULL,
  "authorHeadline" TEXT NOT NULL,
  "authorBiography" TEXT NOT NULL,
  "authorLocationText" TEXT,
  "authorPersonalWebsiteUrl" TEXT,
  "authorGithubProfileUrl" TEXT,
  "visibility" "PublicationVisibility" NOT NULL,
  "publishedByUserId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contentHash" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectPublicationRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationClaimSnapshot" (
  "id" TEXT NOT NULL,
  "publicationRevisionId" TEXT NOT NULL,
  "sourceClaimId" TEXT NOT NULL,
  "publicClaimIdentifier" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "statement" TEXT NOT NULL,
  "statementHash" TEXT NOT NULL,
  "claimOrigin" "ClaimOrigin" NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "humanEdited" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationClaimSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationEvidenceSnapshot" (
  "id" TEXT NOT NULL,
  "publicationRevisionId" TEXT NOT NULL,
  "publicationClaimSnapshotId" TEXT NOT NULL,
  "sourceRepositoryEvidenceId" TEXT NOT NULL,
  "publicDisclosureIdentifier" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "evidenceType" TEXT NOT NULL,
  "publicTitle" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "disclosureMode" "EvidenceDisclosureMode" NOT NULL,
  "canonicalPublicSourceUrl" TEXT,
  "sourceVisibility" TEXT NOT NULL,
  "publicProvenanceText" TEXT NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'FACT',
  "sourceContentHash" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationEvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "publicationId" TEXT,
  "actorUserId" TEXT,
  "kind" "PublicationEventKind" NOT NULL,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioOutput" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "trackedRepositoryId" TEXT NOT NULL,
  "type" "PortfolioOutputType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" "PortfolioOutputStatus" NOT NULL DEFAULT 'DRAFT',
  "draftFields" JSONB NOT NULL,
  "currentRevisionId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioOutput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioOutputClaim" (
  "outputId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "trackedRepositoryId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "statementOverride" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioOutputClaim_pkey" PRIMARY KEY ("outputId", "claimId")
);

CREATE TABLE "PortfolioOutputRevision" (
  "id" TEXT NOT NULL,
  "outputId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "claimSnapshots" JSONB NOT NULL,
  "userFields" JSONB NOT NULL,
  "structuredContent" JSONB NOT NULL,
  "renderedText" TEXT NOT NULL,
  "renderedMarkdown" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioOutputRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicProfile_workspaceId_key" ON "PublicProfile"("workspaceId");
CREATE UNIQUE INDEX "PublicProfile_slug_key" ON "PublicProfile"("slug");
CREATE UNIQUE INDEX "PublicProfile_slug_lower_key" ON "PublicProfile"(LOWER("slug"));
CREATE INDEX "PublicProfile_visibility_latestPublishedAt_idx" ON "PublicProfile"("visibility", "latestPublishedAt");
CREATE UNIQUE INDEX "PublicSlugReservation_slug_key" ON "PublicSlugReservation"("slug");
CREATE UNIQUE INDEX "PublicSlugReservation_slug_lower_key" ON "PublicSlugReservation"(LOWER("slug"));
CREATE INDEX "PublicSlugReservation_kind_firstReservedAt_idx" ON "PublicSlugReservation"("kind", "firstReservedAt");
CREATE UNIQUE INDEX "ProjectPublication_slug_key" ON "ProjectPublication"("slug");
CREATE UNIQUE INDEX "ProjectPublication_slug_lower_key" ON "ProjectPublication"(LOWER("slug"));
CREATE UNIQUE INDEX "ProjectPublication_currentPublishedRevisionId_key" ON "ProjectPublication"("currentPublishedRevisionId");
CREATE UNIQUE INDEX "ProjectPublication_lastPublishIdempotencyKey_key" ON "ProjectPublication"("lastPublishIdempotencyKey");
CREATE UNIQUE INDEX "ProjectPublication_id_trackedRepositoryId_key" ON "ProjectPublication"("id", "trackedRepositoryId");
CREATE INDEX "ProjectPublication_workspaceId_status_updatedAt_idx" ON "ProjectPublication"("workspaceId", "status", "updatedAt");
CREATE INDEX "ProjectPublication_profileId_status_visibility_latestPublishedAt_idx" ON "ProjectPublication"("profileId", "status", "visibility", "latestPublishedAt");
CREATE INDEX "ProjectPublication_status_visibility_latestPublishedAt_idx" ON "ProjectPublication"("status", "visibility", "latestPublishedAt");
CREATE INDEX "ProjectPublication_trackedRepositoryId_healthState_idx" ON "ProjectPublication"("trackedRepositoryId", "healthState");
CREATE UNIQUE INDEX "PublicationClaimSelection_publicationId_position_key" ON "PublicationClaimSelection"("publicationId", "position");
CREATE INDEX "PublicationClaimSelection_claimId_idx" ON "PublicationClaimSelection"("claimId");
CREATE INDEX "PublicationClaimSelection_trackedRepositoryId_idx" ON "PublicationClaimSelection"("trackedRepositoryId");
CREATE UNIQUE INDEX "PublicationEvidenceDisclosure_publicationId_claimId_position_key" ON "PublicationEvidenceDisclosure"("publicationId", "claimId", "position");
CREATE INDEX "PublicationEvidenceDisclosure_repositoryEvidenceId_idx" ON "PublicationEvidenceDisclosure"("repositoryEvidenceId");
CREATE INDEX "PublicationEvidenceDisclosure_trackedRepositoryId_idx" ON "PublicationEvidenceDisclosure"("trackedRepositoryId");
CREATE UNIQUE INDEX "ProjectPublicationRevision_publicationId_revisionNumber_key" ON "ProjectPublicationRevision"("publicationId", "revisionNumber");
CREATE INDEX "ProjectPublicationRevision_publicationId_publishedAt_idx" ON "ProjectPublicationRevision"("publicationId", "publishedAt");
CREATE INDEX "ProjectPublicationRevision_visibility_publishedAt_idx" ON "ProjectPublicationRevision"("visibility", "publishedAt");
CREATE INDEX "ProjectPublicationRevision_publishedByUserId_publishedAt_idx" ON "ProjectPublicationRevision"("publishedByUserId", "publishedAt");
CREATE UNIQUE INDEX "PublicationClaimSnapshot_publicationRevisionId_position_key" ON "PublicationClaimSnapshot"("publicationRevisionId", "position");
CREATE UNIQUE INDEX "PublicationClaimSnapshot_revision_publicIdentifier_key" ON "PublicationClaimSnapshot"("publicationRevisionId", "publicClaimIdentifier");
CREATE INDEX "PublicationClaimSnapshot_sourceClaimId_idx" ON "PublicationClaimSnapshot"("sourceClaimId");
CREATE UNIQUE INDEX "PublicationEvidenceSnapshot_claim_position_key" ON "PublicationEvidenceSnapshot"("publicationClaimSnapshotId", "position");
CREATE UNIQUE INDEX "PublicationEvidenceSnapshot_revision_publicIdentifier_key" ON "PublicationEvidenceSnapshot"("publicationRevisionId", "publicDisclosureIdentifier");
CREATE INDEX "PublicationEvidenceSnapshot_publicationRevisionId_idx" ON "PublicationEvidenceSnapshot"("publicationRevisionId");
CREATE INDEX "PublicationEvidenceSnapshot_sourceRepositoryEvidenceId_idx" ON "PublicationEvidenceSnapshot"("sourceRepositoryEvidenceId");
CREATE INDEX "PublicationEvent_workspaceId_createdAt_idx" ON "PublicationEvent"("workspaceId", "createdAt");
CREATE INDEX "PublicationEvent_publicationId_createdAt_idx" ON "PublicationEvent"("publicationId", "createdAt");
CREATE INDEX "PublicationEvent_actorUserId_createdAt_idx" ON "PublicationEvent"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "PortfolioOutput_currentRevisionId_key" ON "PortfolioOutput"("currentRevisionId");
CREATE UNIQUE INDEX "PortfolioOutput_id_trackedRepositoryId_key" ON "PortfolioOutput"("id", "trackedRepositoryId");
CREATE INDEX "PortfolioOutput_workspaceId_status_updatedAt_idx" ON "PortfolioOutput"("workspaceId", "status", "updatedAt");
CREATE INDEX "PortfolioOutput_trackedRepositoryId_type_idx" ON "PortfolioOutput"("trackedRepositoryId", "type");
CREATE UNIQUE INDEX "PortfolioOutputClaim_outputId_position_key" ON "PortfolioOutputClaim"("outputId", "position");
CREATE INDEX "PortfolioOutputClaim_claimId_idx" ON "PortfolioOutputClaim"("claimId");
CREATE INDEX "PortfolioOutputClaim_trackedRepositoryId_idx" ON "PortfolioOutputClaim"("trackedRepositoryId");
CREATE UNIQUE INDEX "PortfolioOutputRevision_outputId_revisionNumber_key" ON "PortfolioOutputRevision"("outputId", "revisionNumber");
CREATE INDEX "PortfolioOutputRevision_createdByUserId_createdAt_idx" ON "PortfolioOutputRevision"("createdByUserId", "createdAt");

ALTER TABLE "PublicProfile" ADD CONSTRAINT "PublicProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPublication" ADD CONSTRAINT "ProjectPublication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPublication" ADD CONSTRAINT "ProjectPublication_trackedRepositoryId_fkey" FOREIGN KEY ("trackedRepositoryId") REFERENCES "TrackedRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPublication" ADD CONSTRAINT "ProjectPublication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PublicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationClaimSelection" ADD CONSTRAINT "PublicationClaimSelection_publication_fkey" FOREIGN KEY ("publicationId", "trackedRepositoryId") REFERENCES "ProjectPublication"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationClaimSelection" ADD CONSTRAINT "PublicationClaimSelection_claim_fkey" FOREIGN KEY ("claimId", "trackedRepositoryId") REFERENCES "EvidenceClaim"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationEvidenceDisclosure" ADD CONSTRAINT "PublicationEvidenceDisclosure_publication_fkey" FOREIGN KEY ("publicationId", "trackedRepositoryId") REFERENCES "ProjectPublication"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationEvidenceDisclosure" ADD CONSTRAINT "PublicationEvidenceDisclosure_claimSelection_fkey" FOREIGN KEY ("publicationId", "claimId") REFERENCES "PublicationClaimSelection"("publicationId", "claimId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationEvidenceDisclosure" ADD CONSTRAINT "PublicationEvidenceDisclosure_repositoryEvidence_fkey" FOREIGN KEY ("repositoryEvidenceId", "trackedRepositoryId") REFERENCES "RepositoryEvidence"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPublicationRevision" ADD CONSTRAINT "ProjectPublicationRevision_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "ProjectPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPublicationRevision" ADD CONSTRAINT "ProjectPublicationRevision_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectPublication" ADD CONSTRAINT "ProjectPublication_currentPublishedRevisionId_fkey" FOREIGN KEY ("currentPublishedRevisionId") REFERENCES "ProjectPublicationRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicationClaimSnapshot" ADD CONSTRAINT "PublicationClaimSnapshot_publicationRevisionId_fkey" FOREIGN KEY ("publicationRevisionId") REFERENCES "ProjectPublicationRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationClaimSnapshot" ADD CONSTRAINT "PublicationClaimSnapshot_sourceClaimId_fkey" FOREIGN KEY ("sourceClaimId") REFERENCES "EvidenceClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationEvidenceSnapshot" ADD CONSTRAINT "PublicationEvidenceSnapshot_publicationRevisionId_fkey" FOREIGN KEY ("publicationRevisionId") REFERENCES "ProjectPublicationRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationEvidenceSnapshot" ADD CONSTRAINT "PublicationEvidenceSnapshot_publicationClaimSnapshotId_fkey" FOREIGN KEY ("publicationClaimSnapshotId") REFERENCES "PublicationClaimSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationEvidenceSnapshot" ADD CONSTRAINT "PublicationEvidenceSnapshot_sourceRepositoryEvidenceId_fkey" FOREIGN KEY ("sourceRepositoryEvidenceId") REFERENCES "RepositoryEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationEvent" ADD CONSTRAINT "PublicationEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationEvent" ADD CONSTRAINT "PublicationEvent_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "ProjectPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationEvent" ADD CONSTRAINT "PublicationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioOutput" ADD CONSTRAINT "PortfolioOutput_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioOutput" ADD CONSTRAINT "PortfolioOutput_trackedRepositoryId_fkey" FOREIGN KEY ("trackedRepositoryId") REFERENCES "TrackedRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioOutputClaim" ADD CONSTRAINT "PortfolioOutputClaim_output_fkey" FOREIGN KEY ("outputId", "trackedRepositoryId") REFERENCES "PortfolioOutput"("id", "trackedRepositoryId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioOutputClaim" ADD CONSTRAINT "PortfolioOutputClaim_claim_fkey" FOREIGN KEY ("claimId", "trackedRepositoryId") REFERENCES "EvidenceClaim"("id", "trackedRepositoryId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioOutputRevision" ADD CONSTRAINT "PortfolioOutputRevision_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "PortfolioOutput"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioOutputRevision" ADD CONSTRAINT "PortfolioOutputRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioOutput" ADD CONSTRAINT "PortfolioOutput_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "PortfolioOutputRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicProfile" ADD CONSTRAINT "PublicProfile_slug_shape_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") BETWEEN 3 AND 40);
ALTER TABLE "ProjectPublication" ADD CONSTRAINT "ProjectPublication_slug_shape_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") BETWEEN 3 AND 60);
ALTER TABLE "PublicationClaimSelection" ADD CONSTRAINT "PublicationClaimSelection_position_check" CHECK ("position" >= 0);
ALTER TABLE "PublicationEvidenceDisclosure" ADD CONSTRAINT "PublicationEvidenceDisclosure_position_check" CHECK ("position" >= 0);
ALTER TABLE "ProjectPublicationRevision" ADD CONSTRAINT "ProjectPublicationRevision_number_check" CHECK ("revisionNumber" >= 1);
ALTER TABLE "PublicationClaimSnapshot" ADD CONSTRAINT "PublicationClaimSnapshot_position_check" CHECK ("position" >= 0);
ALTER TABLE "PublicationEvidenceSnapshot" ADD CONSTRAINT "PublicationEvidenceSnapshot_position_check" CHECK ("position" >= 0);
ALTER TABLE "PortfolioOutputClaim" ADD CONSTRAINT "PortfolioOutputClaim_position_check" CHECK ("position" >= 0);
ALTER TABLE "PortfolioOutputRevision" ADD CONSTRAINT "PortfolioOutputRevision_number_check" CHECK ("revisionNumber" >= 1);

CREATE FUNCTION "reject_publication_revision_mutation"() RETURNS trigger AS $$
BEGIN
  IF ROW(
    NEW."id", NEW."publicationId", NEW."revisionNumber", NEW."title",
    NEW."summary", NEW."roleText", NEW."projectPeriodText",
    NEW."technologyLabels", NEW."problemText", NEW."approachText",
    NEW."outcomeText", NEW."repositoryDisclosurePolicy",
    NEW."publicRepositoryLabel", NEW."publicRepositoryUrl", NEW."authorSlug",
    NEW."authorDisplayName", NEW."authorHeadline", NEW."authorBiography",
    NEW."authorLocationText", NEW."authorPersonalWebsiteUrl",
    NEW."authorGithubProfileUrl", NEW."visibility", NEW."publishedByUserId",
    NEW."publishedAt", NEW."contentHash", NEW."schemaVersion", NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."id", OLD."publicationId", OLD."revisionNumber", OLD."title",
    OLD."summary", OLD."roleText", OLD."projectPeriodText",
    OLD."technologyLabels", OLD."problemText", OLD."approachText",
    OLD."outcomeText", OLD."repositoryDisclosurePolicy",
    OLD."publicRepositoryLabel", OLD."publicRepositoryUrl", OLD."authorSlug",
    OLD."authorDisplayName", OLD."authorHeadline", OLD."authorBiography",
    OLD."authorLocationText", OLD."authorPersonalWebsiteUrl",
    OLD."authorGithubProfileUrl", OLD."visibility", OLD."publishedByUserId",
    OLD."publishedAt", OLD."contentHash", OLD."schemaVersion", OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'IMMUTABLE_PUBLICATION_REVISION';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProjectPublicationRevision_immutable"
BEFORE UPDATE ON "ProjectPublicationRevision"
FOR EACH ROW EXECUTE FUNCTION "reject_publication_revision_mutation"();

CREATE FUNCTION "reject_current_publication_revision_delete"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ProjectPublication"
    WHERE "currentPublishedRevisionId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'CURRENT_PUBLICATION_REVISION_DELETE_FORBIDDEN';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProjectPublicationRevision_current_delete_guard"
BEFORE DELETE ON "ProjectPublicationRevision"
FOR EACH ROW EXECUTE FUNCTION "reject_current_publication_revision_delete"();

CREATE FUNCTION "reject_immutable_snapshot_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_SNAPSHOT';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PublicationClaimSnapshot_immutable"
BEFORE UPDATE ON "PublicationClaimSnapshot"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_snapshot_update"();

CREATE TRIGGER "PublicationEvidenceSnapshot_immutable"
BEFORE UPDATE ON "PublicationEvidenceSnapshot"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_snapshot_update"();

CREATE TRIGGER "PortfolioOutputRevision_immutable"
BEFORE UPDATE ON "PortfolioOutputRevision"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_snapshot_update"();

CREATE FUNCTION "reject_current_output_revision_delete"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PortfolioOutput"
    WHERE "currentRevisionId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'CURRENT_OUTPUT_REVISION_DELETE_FORBIDDEN';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PortfolioOutputRevision_current_delete_guard"
BEFORE DELETE ON "PortfolioOutputRevision"
FOR EACH ROW EXECUTE FUNCTION "reject_current_output_revision_delete"();
