import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { request, type FullConfig } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { AUTH_STATE, E2E_IDS, E2E_USER } from "./fixtures";

export default async function globalSetup(config: FullConfig) {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl || !/test/i.test(new URL(testUrl).pathname))
    throw new Error("E2E_REQUIRES_VALIDATED_TEST_DATABASE");
  if (process.env.NODE_ENV === "production")
    throw new Error("E2E_FIXTURES_FORBIDDEN_IN_PRODUCTION");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testUrl }),
  });
  try {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    await prisma.publicSlugReservation.deleteMany();

    const baseURL = String(config.projects[0]?.use.baseURL);
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL },
    });
    const registration = await api.post("/api/auth/sign-up/email", {
      data: E2E_USER,
    });
    if (!registration.ok())
      throw new Error(`E2E_REGISTRATION_FAILED_${registration.status()}`);
    await mkdir(dirname(AUTH_STATE), { recursive: true });
    await api.storageState({ path: AUTH_STATE });
    await api.dispose();

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: E2E_USER.email },
    });
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { ownerUserId: user.id },
    });
    await seedReleaseFixture(prisma, user.id, workspace.id);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedReleaseFixture(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
) {
  const fixed = new Date("2026-07-01T12:00:00.000Z");
  const installation = await prisma.gitHubInstallation.create({
    data: {
      id: "e2e-installation",
      workspaceId,
      installationId: BigInt(61001),
      accountId: BigInt(61002),
      accountLogin: "synthetic-labs",
      accountType: "Organization",
      repositorySelection: "SELECTED",
      permissions: { metadata: "read", contents: "read" },
      verifiedAt: fixed,
      lastRepositoryDiscoveryAt: fixed,
    },
  });
  const publicRepository = await prisma.trackedRepository.create({
    data: {
      id: E2E_IDS.publicRepository,
      workspaceId,
      githubInstallationId: installation.id,
      githubRepositoryId: BigInt(61003),
      ownerLogin: "synthetic-labs",
      name: "release-evidence",
      fullName: "synthetic-labs/release-evidence",
      visibility: "public",
      defaultBranch: "main",
      sourceType: "INSTALLATION",
      trackingStatus: "ACTIVE",
      latestSyncStatus: "SUCCEEDED",
      lastSuccessfulSyncAt: fixed,
      snapshot: {
        create: {
          normalizedData: {
            identity: { fullName: "synthetic-labs/release-evidence" },
            defaultBranch: "main",
            isPrivate: false,
          },
          sourceUpdatedAt: fixed,
          sourcePushedAt: fixed,
          fetchedAt: fixed,
        },
      },
    },
  });
  const privateRepository = await prisma.trackedRepository.create({
    data: {
      id: E2E_IDS.privateRepository,
      workspaceId,
      githubInstallationId: installation.id,
      githubRepositoryId: BigInt(61004),
      ownerLogin: "synthetic-private",
      name: "redacted-source",
      fullName: "synthetic-private/redacted-source",
      visibility: "private",
      defaultBranch: "main",
      sourceType: "INSTALLATION",
      trackingStatus: "ACTIVE",
      latestSyncStatus: "PARTIAL",
      lastSuccessfulSyncAt: fixed,
    },
  });
  const publicEvidence = await prisma.repositoryEvidence.create({
    data: {
      id: "e2e-public-evidence",
      trackedRepositoryId: publicRepository.id,
      evidenceId: "github:release:v1.0.0",
      evidenceType: "release",
      githubSourceId: "v1.0.0",
      canonicalUrl:
        "https://github.com/synthetic-labs/release-evidence/releases/tag/v1.0.0",
      occurredAt: fixed,
      title: "Published the deterministic release workflow",
      factualPayload: { tag: "v1.0.0" },
      normalizedContentHash: "a".repeat(64),
    },
  });
  const privateEvidence = await prisma.repositoryEvidence.create({
    data: {
      id: "e2e-private-evidence",
      trackedRepositoryId: privateRepository.id,
      evidenceId: "github:commit:redacted",
      evidenceType: "commit",
      githubSourceId: "redacted-fixture",
      canonicalUrl:
        "https://github.com/synthetic-private/redacted-source/commit/redacted-fixture",
      occurredAt: fixed,
      title: "Private source fixture",
      factualPayload: { synthetic: true },
      normalizedContentHash: "b".repeat(64),
    },
  });
  const publicClaim = await prisma.evidenceClaim.create({
    data: {
      id: E2E_IDS.publicClaim,
      workspaceId,
      trackedRepositoryId: publicRepository.id,
      authorUserId: userId,
      statement:
        "Built a deterministic release gate with migration, privacy, and browser checks.",
      status: "VERIFIED",
      origin: "AI_ASSISTED",
      humanEditedAfterAcceptance: true,
      verifiedAt: fixed,
      evidenceLinks: {
        create: {
          repositoryEvidenceId: publicEvidence.id,
          linkedByUserId: userId,
        },
      },
      revisions: {
        create: {
          actorUserId: userId,
          revisionNumber: 1,
          kind: "VERIFIED",
          statementSnapshot:
            "Built a deterministic release gate with migration, privacy, and browser checks.",
          status: "VERIFIED",
          evidenceIdSnapshot: publicEvidence.id,
          changeSummary: "Synthetic release fixture verified.",
        },
      },
    },
  });
  const privateClaim = await prisma.evidenceClaim.create({
    data: {
      id: E2E_IDS.privateClaim,
      workspaceId,
      trackedRepositoryId: privateRepository.id,
      authorUserId: userId,
      statement:
        "Designed privacy-safe publication behavior for private source evidence.",
      status: "VERIFIED",
      origin: "HUMAN",
      verifiedAt: fixed,
      evidenceLinks: {
        create: {
          repositoryEvidenceId: privateEvidence.id,
          linkedByUserId: userId,
        },
      },
    },
  });
  const profile = await prisma.publicProfile.create({
    data: {
      id: "e2e-profile",
      workspaceId,
      slug: "synthetic-engineer",
      displayName: "Synthetic Engineer",
      headline: "Evidence-first release engineering",
      biography:
        "A deterministic fictional profile used only for CommitTrail release verification.",
      locationText: "Fixture environment",
      personalWebsiteUrl: "https://example.com",
      githubProfileUrl: "https://github.com/synthetic-labs",
      visibility: "PUBLIC",
      firstPublishedAt: fixed,
      latestPublishedAt: fixed,
    },
  });
  await prisma.publicSlugReservation.createMany({
    data: [
      {
        slug: profile.slug,
        kind: "PROFILE",
        reservedByWorkspaceHash: "fixture-profile-reservation",
      },
      {
        slug: "release-evidence-project",
        kind: "PROJECT",
        reservedByWorkspaceHash: "fixture-public-project-reservation",
      },
      {
        slug: "private-source-story",
        kind: "PROJECT",
        reservedByWorkspaceHash: "fixture-private-project-reservation",
      },
      {
        slug: "unpublished-fixture",
        kind: "PROJECT",
        reservedByWorkspaceHash: "fixture-unpublished-project-reservation",
      },
    ],
  });
  await createPublication(prisma, {
    id: "e2e-public-publication",
    workspaceId,
    repositoryId: publicRepository.id,
    profileId: profile.id,
    claimId: publicClaim.id,
    evidenceId: publicEvidence.id,
    userId,
    slug: "release-evidence-project",
    visibility: "PUBLIC",
    disclosureMode: "PUBLIC_SOURCE",
    sourceUrl: publicEvidence.canonicalUrl,
    sourceVisibility: "PUBLIC",
    title: "Release evidence project",
    statement: publicClaim.statement,
    fixed,
  });
  await createPublication(prisma, {
    id: "e2e-unlisted-publication",
    workspaceId,
    repositoryId: privateRepository.id,
    profileId: profile.id,
    claimId: privateClaim.id,
    evidenceId: privateEvidence.id,
    userId,
    slug: "private-source-story",
    visibility: "UNLISTED",
    disclosureMode: "PRIVATE_SOURCE_REDACTED",
    sourceUrl: null,
    sourceVisibility: "PRIVATE",
    title: "Private source story",
    statement: privateClaim.statement,
    fixed,
  });
  await prisma.projectPublication.create({
    data: {
      id: "e2e-unpublished-publication",
      workspaceId,
      trackedRepositoryId: publicRepository.id,
      profileId: profile.id,
      slug: "unpublished-fixture",
      internalTitle: "Unpublished fixture",
      title: "Unpublished fixture",
      summary: "This private draft must not have a public route.",
      roleText: "Maintainer",
      repositoryDisclosurePolicy: "PUBLIC_REPOSITORY",
      status: "DRAFT",
      visibility: "UNLISTED",
    },
  });
  const output = await prisma.portfolioOutput.create({
    data: {
      id: E2E_IDS.output,
      workspaceId,
      trackedRepositoryId: publicRepository.id,
      type: "CASE_STUDY",
      title: "Release gate case study",
      status: "READY",
      draftFields: {
        summary: "Deterministic release verification.",
        challenge: "Validate trust boundaries without live providers.",
        approach: "Use synthetic fixtures and PostgreSQL-backed checks.",
        outcome: "A repeatable release gate.",
      },
      claimSelections: {
        create: {
          claimId: publicClaim.id,
          position: 0,
        },
      },
    },
  });
  const outputRevision = await prisma.portfolioOutputRevision.create({
    data: {
      id: "e2e-output-revision",
      outputId: output.id,
      revisionNumber: 1,
      claimSnapshots: [{ statement: publicClaim.statement, position: 0 }],
      userFields: { summary: "Deterministic release verification." },
      structuredContent: {
        sections: [
          { heading: "Summary", body: "Deterministic release verification." },
        ],
      },
      renderedText:
        "Release gate case study\n\nDeterministic release verification.",
      renderedMarkdown:
        "# Release gate case study\n\nDeterministic release verification.",
      contentHash: "c".repeat(64),
      createdByUserId: userId,
      createdAt: fixed,
    },
  });
  await prisma.portfolioOutput.update({
    where: { id: output.id },
    data: { currentRevisionId: outputRevision.id },
  });
}

async function createPublication(
  prisma: PrismaClient,
  input: {
    id: string;
    workspaceId: string;
    repositoryId: string;
    profileId: string;
    claimId: string;
    evidenceId: string;
    userId: string;
    slug: string;
    visibility: "PUBLIC" | "UNLISTED";
    disclosureMode: "PUBLIC_SOURCE" | "PRIVATE_SOURCE_REDACTED";
    sourceUrl: string | null;
    sourceVisibility: string;
    title: string;
    statement: string;
    fixed: Date;
  },
) {
  const publication = await prisma.projectPublication.create({
    data: {
      id: input.id,
      workspaceId: input.workspaceId,
      trackedRepositoryId: input.repositoryId,
      profileId: input.profileId,
      slug: input.slug,
      internalTitle: input.title,
      title: input.title,
      summary: "A deterministic evidence-backed release fixture.",
      roleText: "Maintainer",
      projectPeriodText: "2026",
      technologyLabels: ["Next.js", "PostgreSQL", "Playwright"],
      problemText:
        "Release verification needed trustworthy, repeatable evidence.",
      approachText: "Applied bounded checks and explicit review gates.",
      outcomeText: "Created a reproducible portfolio-quality release workflow.",
      repositoryDisclosurePolicy:
        input.sourceVisibility === "PUBLIC"
          ? "PUBLIC_REPOSITORY"
          : "IDENTITY_REDACTED",
      status: "PUBLISHED",
      visibility: input.visibility,
      firstPublishedAt: input.fixed,
      latestPublishedAt: input.fixed,
      healthState: "CURRENT",
      healthCheckedAt: input.fixed,
    },
  });
  const revision = await prisma.projectPublicationRevision.create({
    data: {
      id: `${input.id}-revision`,
      publicationId: publication.id,
      revisionNumber: 1,
      title: input.title,
      summary: "A deterministic evidence-backed release fixture.",
      roleText: "Maintainer",
      projectPeriodText: "2026",
      technologyLabels: ["Next.js", "PostgreSQL", "Playwright"],
      problemText:
        "Release verification needed trustworthy, repeatable evidence.",
      approachText: "Applied bounded checks and explicit review gates.",
      outcomeText: "Created a reproducible portfolio-quality release workflow.",
      repositoryDisclosurePolicy:
        input.sourceVisibility === "PUBLIC"
          ? "PUBLIC_REPOSITORY"
          : "IDENTITY_REDACTED",
      publicRepositoryLabel:
        input.sourceVisibility === "PUBLIC"
          ? "synthetic-labs/release-evidence"
          : null,
      publicRepositoryUrl:
        input.sourceVisibility === "PUBLIC"
          ? "https://github.com/synthetic-labs/release-evidence"
          : null,
      authorSlug: "synthetic-engineer",
      authorDisplayName: "Synthetic Engineer",
      authorHeadline: "Evidence-first release engineering",
      authorBiography:
        "A deterministic fictional profile used only for CommitTrail release verification.",
      authorLocationText: "Fixture environment",
      authorPersonalWebsiteUrl: "https://example.com",
      authorGithubProfileUrl: "https://github.com/synthetic-labs",
      visibility: input.visibility,
      publishedByUserId: input.userId,
      publishedAt: input.fixed,
      contentHash: "d".repeat(64),
      schemaVersion: 1,
      createdAt: input.fixed,
    },
  });
  const claim = await prisma.publicationClaimSnapshot.create({
    data: {
      id: `${input.id}-claim`,
      publicationRevisionId: revision.id,
      sourceClaimId: input.claimId,
      publicClaimIdentifier: `claim-${input.slug}`,
      position: 0,
      statement: input.statement,
      statementHash: "e".repeat(64),
      claimOrigin:
        input.slug === "release-evidence-project" ? "AI_ASSISTED" : "HUMAN",
      verifiedAt: input.fixed,
      humanEdited: input.slug === "release-evidence-project",
      createdAt: input.fixed,
    },
  });
  await prisma.publicationEvidenceSnapshot.create({
    data: {
      id: `${input.id}-evidence`,
      publicationRevisionId: revision.id,
      publicationClaimSnapshotId: claim.id,
      sourceRepositoryEvidenceId: input.evidenceId,
      publicDisclosureIdentifier: `evidence-${input.slug}`,
      position: 0,
      evidenceType:
        input.disclosureMode === "PUBLIC_SOURCE" ? "release" : "commit",
      publicTitle:
        input.disclosureMode === "PUBLIC_SOURCE"
          ? "Published the deterministic release workflow"
          : "Private source evidence",
      occurredAt: input.fixed,
      disclosureMode: input.disclosureMode,
      canonicalPublicSourceUrl: input.sourceUrl,
      sourceVisibility: input.sourceVisibility,
      publicProvenanceText:
        input.disclosureMode === "PUBLIC_SOURCE"
          ? "Public GitHub release evidence."
          : "Source evidence belongs to a private repository and is not publicly accessible.",
      confidence: "FACT",
      sourceContentHash: "f".repeat(64),
      contentHash: "1".repeat(64),
      createdAt: input.fixed,
    },
  });
  await prisma.projectPublication.update({
    where: { id: publication.id },
    data: { currentPublishedRevisionId: revision.id },
  });
}
