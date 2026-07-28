import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const {
  requireOwnerMock,
  revalidatePathMock,
  revalidateTagMock,
  getSessionMock,
  workspaceMock,
} = vi.hoisted(() => ({
  requireOwnerMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  getSessionMock: vi.fn(),
  workspaceMock: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireWorkspaceOwner: requireOwnerMock,
}));
vi.mock("@/lib/auth/auth", () => ({
  getAuth: () => ({ api: { getSession: getSessionMock } }),
}));
vi.mock("@/lib/auth/workspace", () => ({
  ensurePersonalWorkspace: workspaceMock,
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
  unstable_cache: (callback: () => unknown) => callback,
}));

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe.sequential : describe.skip;

suite("Phase 5 PostgreSQL publishing and portfolio outputs", () => {
  let prisma: PrismaClient;
  let workspaceId: string;
  let userId: string;
  let otherWorkspaceId: string;
  let otherUserId: string;
  let privateRepositoryId: string;
  let publicRepositoryId: string;
  let privateEvidenceId: string;
  let publicEvidenceId: string;
  let humanClaimId: string;
  let aiClaimId: string;
  let publicationId: string;
  let outputId: string;

  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      !/test/i.test(new URL(process.env.TEST_DATABASE_URL).pathname)
    )
      throw new Error("A clearly named TEST_DATABASE_URL is required.");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    prisma = (await import("@/lib/db/prisma")).getPrisma();
    await prisma.user.deleteMany({
      where: { id: { startsWith: "phase5-" } },
    });
    await prisma.publicSlugReservation.deleteMany({
      where: { reservedByWorkspaceHash: { not: "" } },
    });
    const owner = await prisma.user.create({
      data: {
        id: "phase5-user-record",
        name: "Phase 5 Owner",
        email: "phase5-owner@example.test",
      },
    });
    userId = owner.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: "Phase 5 workspace",
        slug: "phase5-workspace",
        ownerUserId: owner.id,
        members: { create: { userId: owner.id, role: "OWNER" } },
      },
    });
    workspaceId = workspace.id;
    const other = await prisma.user.create({
      data: {
        id: "phase5-other",
        name: "Other Owner",
        email: "phase5-other@example.test",
      },
    });
    otherUserId = other.id;
    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: "Other workspace",
        slug: "phase5-other-workspace",
        ownerUserId: other.id,
        members: { create: { userId: other.id, role: "OWNER" } },
      },
    });
    otherWorkspaceId = otherWorkspace.id;
    const installation = await prisma.gitHubInstallation.create({
      data: {
        workspaceId,
        installationId: BigInt(95001),
        accountId: BigInt(95002),
        accountLogin: "private-owner",
        accountType: "User",
        repositorySelection: "SELECTED",
        permissions: { metadata: "read", contents: "read" },
        verifiedAt: new Date(),
      },
    });
    const privateRepository = await prisma.trackedRepository.create({
      data: {
        workspaceId,
        githubInstallationId: installation.id,
        githubRepositoryId: BigInt(95003),
        ownerLogin: "private-owner",
        name: "secret-repository",
        fullName: "private-owner/secret-repository",
        visibility: "private",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    privateRepositoryId = privateRepository.id;
    const publicRepository = await prisma.trackedRepository.create({
      data: {
        workspaceId,
        githubInstallationId: installation.id,
        githubRepositoryId: BigInt(95004),
        ownerLogin: "public-owner",
        name: "public-repository",
        fullName: "public-owner/public-repository",
        visibility: "public",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    publicRepositoryId = publicRepository.id;
    const privateEvidence = await prisma.repositoryEvidence.create({
      data: {
        trackedRepositoryId: privateRepository.id,
        evidenceId: "github:commit:private-sha",
        evidenceType: "commit",
        githubSourceId: "private-sha-123456789",
        canonicalUrl:
          "https://github.com/private-owner/secret-repository/commit/private-sha-123456789",
        occurredAt: new Date("2026-07-20T00:00:00Z"),
        title: "Private release internals",
        factualPayload: {
          sha: "private-sha-123456789",
          branch: "secret-branch",
        },
        normalizedContentHash: "a".repeat(64),
      },
    });
    privateEvidenceId = privateEvidence.id;
    const publicEvidence = await prisma.repositoryEvidence.create({
      data: {
        trackedRepositoryId: publicRepository.id,
        evidenceId: "github:release:95005",
        evidenceType: "release",
        githubSourceId: "95005",
        canonicalUrl:
          "https://github.com/public-owner/public-repository/releases/tag/v1",
        occurredAt: new Date("2026-07-21T00:00:00Z"),
        title: "Release v1",
        factualPayload: { tagName: "v1", assetCount: 1 },
        normalizedContentHash: "b".repeat(64),
      },
    });
    publicEvidenceId = publicEvidence.id;
    const humanClaim = await prisma.evidenceClaim.create({
      data: {
        workspaceId,
        trackedRepositoryId: privateRepository.id,
        authorUserId: userId,
        statement: "Implemented a reviewed private release workflow.",
        status: "VERIFIED",
        verifiedAt: new Date("2026-07-22T00:00:00Z"),
        evidenceLinks: {
          create: {
            repositoryEvidenceId: privateEvidence.id,
            linkedByUserId: userId,
          },
        },
      },
    });
    humanClaimId = humanClaim.id;
    const aiClaim = await prisma.evidenceClaim.create({
      data: {
        workspaceId,
        trackedRepositoryId: publicRepository.id,
        authorUserId: userId,
        statement: "Published release v1 with one recorded asset.",
        status: "VERIFIED",
        origin: "AI_ASSISTED",
        verifiedAt: new Date("2026-07-23T00:00:00Z"),
        humanEditedAfterAcceptance: true,
        evidenceLinks: {
          create: {
            repositoryEvidenceId: publicEvidence.id,
            linkedByUserId: userId,
          },
        },
      },
    });
    aiClaimId = aiClaim.id;
    const request = await prisma.draftGenerationRequest.create({
      data: {
        workspaceId,
        trackedRepositoryId: publicRepository.id,
        requestedByUserId: userId,
        providerKind: "FIXTURE",
        providerClassification: "LOCAL",
        providerIdentityHash: "c".repeat(64),
        modelLabel: "deterministic fixture",
        promptTemplateVersion: 1,
        evidenceBundleVersion: 1,
        evidenceBundleHash: "d".repeat(64),
        draftingIntent: "Describe the public release",
        style: "CONCISE",
        status: "SUCCEEDED",
        requestHash: "e".repeat(64),
        inputEvidenceCount: 1,
        inputByteCount: 100,
        evidenceSelections: {
          create: {
            repositoryEvidenceId: publicEvidence.id,
            evidenceContentHash: publicEvidence.normalizedContentHash,
            position: 0,
          },
        },
      },
    });
    await prisma.draftCandidate.create({
      data: {
        requestId: request.id,
        combinedStatement: aiClaim.statement,
        caveats: [],
        policyWarnings: [],
        groundingStatus: "VALID",
        reviewStatus: "ACCEPTED",
        sentenceCount: 1,
        citedSentenceCount: 1,
        uniqueEvidenceCount: 1,
        selectedEvidenceCount: 1,
        evidenceTypesUsed: ["release"],
        unusedSelectedEvidenceCount: 0,
        acceptedClaimId: aiClaim.id,
        reviewedByUserId: userId,
        acceptedAt: new Date(),
      },
    });
    requireOwnerMock.mockResolvedValue({
      workspace,
      session: { user: owner },
    });
    getSessionMock.mockResolvedValue({ user: owner });
    workspaceMock.mockResolvedValue(workspace);
  });

  afterAll(async () => {
    await prisma?.projectPublication.updateMany({
      where: {
        workspaceId: { in: [workspaceId, otherWorkspaceId].filter(Boolean) },
      },
      data: { currentPublishedRevisionId: null },
    });
    await prisma?.projectPublication.deleteMany({
      where: {
        workspaceId: { in: [workspaceId, otherWorkspaceId].filter(Boolean) },
      },
    });
    await prisma?.portfolioOutput.updateMany({
      where: {
        workspaceId: { in: [workspaceId, otherWorkspaceId].filter(Boolean) },
      },
      data: { currentRevisionId: null },
    });
    await prisma?.portfolioOutput.deleteMany({
      where: {
        workspaceId: { in: [workspaceId, otherWorkspaceId].filter(Boolean) },
      },
    });
    await prisma?.user.deleteMany({
      where: { id: { startsWith: "phase5-" } },
    });
    await prisma?.$disconnect();
  });

  it("creates one public profile and reserves its normalized slug", async () => {
    const { savePublicProfileForAuthority } =
      await import("@/lib/publishing/profile-service");
    const profile = await savePublicProfileForAuthority(
      { workspaceId, userId },
      {
        slug: " Phase5-Owner ",
        displayName: "Phase 5 Owner",
        headline: "Evidence-first engineer",
        biography: "I publish only reviewed, evidence-backed work.",
        locationText: "Baku",
        personalWebsiteUrl: "https://example.com/work",
        githubProfileUrl: "https://github.com/phase5-owner",
        visibility: "PUBLIC",
      },
    );
    expect(profile.slug).toBe("phase5-owner");
    expect(profile.firstPublishedAt).not.toBeNull();
    expect(
      await prisma.publicSlugReservation.findUnique({
        where: { slug: profile.slug },
      }),
    ).toMatchObject({ kind: "PROFILE" });
  });

  it("enforces one profile per workspace and case-insensitive slug uniqueness", async () => {
    await expect(
      prisma.publicProfile.create({
        data: {
          workspaceId,
          slug: "another-profile",
          displayName: "Duplicate",
          headline: "Duplicate",
          biography: "Duplicate profile",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.publicProfile.create({
        data: {
          workspaceId: otherWorkspaceId,
          slug: "PHASE5-OWNER",
          displayName: "Collision",
          headline: "Collision",
          biography: "Collision profile",
        },
      }),
    ).rejects.toThrow();
  });

  it("prevents cross-workspace profile writes", async () => {
    const { savePublicProfileForAuthority } =
      await import("@/lib/publishing/profile-service");
    await expect(
      savePublicProfileForAuthority(
        { workspaceId, userId: otherUserId },
        {
          slug: "cross-user",
          displayName: "Cross user",
          headline: "Denied",
          biography: "This write must be denied.",
          visibility: "PRIVATE",
        },
      ),
    ).rejects.toThrow("PROFILE_NOT_FOUND");
  });

  it("creates a private-repository publication draft with redacted evidence", async () => {
    const { createPublicationDraftForAuthority } =
      await import("@/lib/publishing/publication-service");
    const publication = await createPublicationDraftForAuthority(
      { workspaceId, userId },
      privatePublicationInput(),
    );
    publicationId = publication.id;
    const persisted = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publication.id },
      include: {
        claimSelections: { include: { evidenceDisclosures: true } },
        events: true,
      },
    });
    expect(persisted.status).toBe("DRAFT");
    expect(persisted.claimSelections).toHaveLength(1);
    expect(persisted.claimSelections[0].evidenceDisclosures[0].mode).toBe(
      "PRIVATE_SOURCE_REDACTED",
    );
    expect(persisted.events.map((event) => event.kind)).toContain(
      "DRAFT_CREATED",
    );
  });

  it.each([
    ["DRAFT", "draft claim"],
    ["NEEDS_EVIDENCE", "needs-evidence claim"],
    ["ARCHIVED", "archived claim"],
  ] as const)("rejects an ineligible %s claim", async (status, suffix) => {
    const claim = await prisma.evidenceClaim.create({
      data: {
        workspaceId,
        trackedRepositoryId: privateRepositoryId,
        authorUserId: userId,
        statement: `Ineligible ${suffix}.`,
        status,
        evidenceLinks:
          status === "NEEDS_EVIDENCE"
            ? undefined
            : {
                create: {
                  repositoryEvidenceId: privateEvidenceId,
                  linkedByUserId: userId,
                },
              },
      },
    });
    const { createPublicationDraftForAuthority } =
      await import("@/lib/publishing/publication-service");
    await expect(
      createPublicationDraftForAuthority(
        { workspaceId, userId },
        {
          ...privatePublicationInput(),
          slug: `rejected-${status.toLowerCase().replaceAll("_", "-")}`,
          claims: [
            {
              claimId: claim.id,
              evidence: [
                {
                  repositoryEvidenceId: privateEvidenceId,
                  mode: "PRIVATE_SOURCE_REDACTED",
                },
              ],
            },
          ],
        },
      ),
    ).rejects.toThrow("PUBLICATION_CLAIM_INELIGIBLE");
  });

  it("rejects private source links and cross-repository evidence", async () => {
    const { createPublicationDraftForAuthority } =
      await import("@/lib/publishing/publication-service");
    await expect(
      createPublicationDraftForAuthority(
        { workspaceId, userId },
        {
          ...privatePublicationInput(),
          slug: "private-source-link",
          claims: [
            {
              claimId: humanClaimId,
              evidence: [
                {
                  repositoryEvidenceId: privateEvidenceId,
                  mode: "PUBLIC_SOURCE",
                },
              ],
            },
          ],
        },
      ),
    ).rejects.toThrow("PRIVATE_SOURCE_REDACTION_REQUIRED");
    await expect(
      createPublicationDraftForAuthority(
        { workspaceId, userId },
        {
          ...privatePublicationInput(),
          slug: "cross-repository-evidence",
          claims: [
            {
              claimId: humanClaimId,
              evidence: [
                {
                  repositoryEvidenceId: publicEvidenceId,
                  mode: "PRIVATE_SOURCE_REDACTED",
                },
              ],
            },
          ],
        },
      ),
    ).rejects.toThrow("PUBLICATION_EVIDENCE_INELIGIBLE");
  });

  it("rejects an AI-assisted claim without completed grounded human review", async () => {
    const unreviewed = await prisma.evidenceClaim.create({
      data: {
        workspaceId,
        trackedRepositoryId: publicRepositoryId,
        authorUserId: userId,
        statement: "An unreviewed AI-assisted statement.",
        status: "VERIFIED",
        origin: "AI_ASSISTED",
        verifiedAt: new Date(),
        evidenceLinks: {
          create: {
            repositoryEvidenceId: publicEvidenceId,
            linkedByUserId: userId,
          },
        },
      },
    });
    const { createPublicationDraftForAuthority } =
      await import("@/lib/publishing/publication-service");
    await expect(
      createPublicationDraftForAuthority(
        { workspaceId, userId },
        {
          ...publicPublicationInput(),
          slug: "unreviewed-ai-claim",
          claims: [
            {
              claimId: unreviewed.id,
              evidence: [
                {
                  repositoryEvidenceId: publicEvidenceId,
                  mode: "PUBLIC_SOURCE",
                },
              ],
            },
          ],
        },
      ),
    ).rejects.toThrow("PUBLICATION_AI_CLAIM_UNVERIFIED");
  });

  it("builds the exact preview without private identifiers", async () => {
    const { previewPublicationForAuthority } =
      await import("@/lib/publishing/publication-service");
    const preview = await previewPublicationForAuthority(
      { workspaceId, userId },
      publicationId,
    );
    const serialized = JSON.stringify(preview);
    expect(preview.claims[0].evidence[0].provenance).toContain(
      "not publicly accessible",
    );
    expect(serialized).not.toContain("secret-repository");
    expect(serialized).not.toContain("private-owner");
    expect(serialized).not.toContain("private-sha-123456789");
    expect(serialized).not.toContain(privateEvidenceId);
    expect(serialized).not.toContain(humanClaimId);
  });

  it("requires typed confirmation and both disclosure acknowledgements", async () => {
    const { publishPublicationForAuthority } =
      await import("@/lib/publishing/publication-service");
    const publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    const base = {
      publicationId,
      confirmation: {
        expectedVersion: publication.version,
        confirmation: "PUBLISH",
        publicDisclosureAcknowledged: true,
        privateSourceAcknowledged: true,
        idempotencyKey: "phase5-publish-key-0001",
      },
    };
    await expect(
      publishPublicationForAuthority(
        { workspaceId, userId },
        {
          ...base,
          confirmation: { ...base.confirmation, confirmation: "publish" },
        },
      ),
    ).rejects.toThrow("PUBLISH_CONFIRMATION_REQUIRED");
    await expect(
      publishPublicationForAuthority(
        { workspaceId, userId },
        {
          ...base,
          confirmation: {
            ...base.confirmation,
            privateSourceAcknowledged: false,
          },
        },
      ),
    ).rejects.toThrow("PRIVATE_SOURCE_ACKNOWLEDGEMENT_REQUIRED");
  });

  it("publishes an immutable UNLISTED revision and supports idempotency", async () => {
    const { publishPublicationForAuthority } =
      await import("@/lib/publishing/publication-service");
    const publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    const input = {
      publicationId,
      confirmation: {
        expectedVersion: publication.version,
        confirmation: "PUBLISH",
        publicDisclosureAcknowledged: true,
        privateSourceAcknowledged: true,
        idempotencyKey: "phase5-publish-key-0001",
      },
    };
    const first = await publishPublicationForAuthority(
      { workspaceId, userId },
      input,
    );
    const duplicate = await publishPublicationForAuthority(
      { workspaceId, userId },
      input,
    );
    expect(first.revision.revisionNumber).toBe(1);
    expect(duplicate.idempotent).toBe(true);
    expect(
      await prisma.projectPublicationRevision.count({
        where: { publicationId },
      }),
    ).toBe(1);
  });

  it("serves UNLISTED directly from the immutable revision without private data", async () => {
    const { getPublicPublicationBySlug } =
      await import("@/lib/publishing/publication-service");
    const project = await getPublicPublicationBySlug("private-release-story");
    expect(project?.visibility).toBe("UNLISTED");
    expect(project?.revisionNumber).toBe(1);
    const serialized = JSON.stringify(project);
    expect(serialized).not.toContain("secret-repository");
    expect(serialized).not.toContain("private-sha");
    expect(serialized).not.toContain(workspaceId);
    expect(serialized).not.toContain(userId);
  });

  it("keeps the public revision unchanged while the private draft changes", async () => {
    const { getPublicPublicationBySlug, updatePublicationDraftForAuthority } =
      await import("@/lib/publishing/publication-service");
    const before = await getPublicPublicationBySlug("private-release-story");
    const publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    await updatePublicationDraftForAuthority(
      { workspaceId, userId },
      {
        publicationId,
        expectedVersion: publication.version,
        draft: {
          ...privatePublicationInput(),
          title: "Updated private draft title",
        },
      },
    );
    const after = await getPublicPublicationBySlug("private-release-story");
    expect(after?.title).toBe(before?.title);
    expect(after?.contentHash).toBe(before?.contentHash);
  });

  it("publishes a replacement revision without mutating revision one", async () => {
    const { publishPublicationForAuthority } =
      await import("@/lib/publishing/publication-service");
    const publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    await publishPublicationForAuthority(
      { workspaceId, userId },
      {
        publicationId,
        confirmation: {
          expectedVersion: publication.version,
          confirmation: "PUBLISH",
          publicDisclosureAcknowledged: true,
          privateSourceAcknowledged: true,
          idempotencyKey: "phase5-publish-key-0002",
        },
      },
    );
    const revisions = await prisma.projectPublicationRevision.findMany({
      where: { publicationId },
      orderBy: { revisionNumber: "asc" },
    });
    expect(revisions.map((revision) => revision.title)).toEqual([
      "Private release story",
      "Updated private draft title",
    ]);
    expect(revisions[0].supersededAt).not.toBeNull();
    await expect(
      prisma.projectPublicationRevision.update({
        where: { id: revisions[0].id },
        data: { title: "Mutated title" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.projectPublicationRevision.delete({
        where: { id: revisions[1].id },
      }),
    ).rejects.toThrow();
  });

  it("unpublishes to a generic public miss and republishes explicitly", async () => {
    const {
      getPublicPublicationBySlug,
      publishPublicationForAuthority,
      unpublishPublicationForAuthority,
    } = await import("@/lib/publishing/publication-service");
    let publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    await unpublishPublicationForAuthority(
      { workspaceId, userId },
      {
        publicationId,
        expectedVersion: publication.version,
        confirmation: "UNPUBLISH",
      },
    );
    expect(
      await getPublicPublicationBySlug("private-release-story"),
    ).toBeNull();
    publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    await publishPublicationForAuthority(
      { workspaceId, userId },
      {
        publicationId,
        confirmation: {
          expectedVersion: publication.version,
          confirmation: "PUBLISH",
          publicDisclosureAcknowledged: true,
          privateSourceAcknowledged: true,
          idempotencyKey: "phase5-publish-key-0003",
        },
      },
    );
    expect(
      (await getPublicPublicationBySlug("private-release-story"))
        ?.revisionNumber,
    ).toBe(3);
  });

  it("rolls back publishing when selected evidence changes before commit", async () => {
    const {
      createPublicationDraftForAuthority,
      publishPublicationForAuthority,
    } = await import("@/lib/publishing/publication-service");
    const draft = await createPublicationDraftForAuthority(
      { workspaceId, userId },
      {
        ...publicPublicationInput(),
        slug: "changed-before-publish",
        visibility: "UNLISTED",
      },
    );
    await prisma.repositoryEvidence.update({
      where: { id: publicEvidenceId },
      data: { normalizedContentHash: "9".repeat(64) },
    });
    await expect(
      publishPublicationForAuthority(
        { workspaceId, userId },
        {
          publicationId: draft.id,
          confirmation: {
            expectedVersion: draft.version,
            confirmation: "PUBLISH",
            publicDisclosureAcknowledged: true,
            privateSourceAcknowledged: false,
            idempotencyKey: "phase5-changed-key-0001",
          },
        },
      ),
    ).rejects.toThrow("PUBLICATION_EVIDENCE_CHANGED");
    expect(
      await prisma.projectPublicationRevision.count({
        where: { publicationId: draft.id },
      }),
    ).toBe(0);
    await prisma.repositoryEvidence.update({
      where: { id: publicEvidenceId },
      data: { normalizedContentHash: "b".repeat(64) },
    });
  });

  it("creates a PUBLIC project with an honest validated source link and AI label", async () => {
    const {
      createPublicationDraftForAuthority,
      publishPublicationForAuthority,
    } = await import("@/lib/publishing/publication-service");
    const publication = await createPublicationDraftForAuthority(
      { workspaceId, userId },
      publicPublicationInput(),
    );
    const published = await publishPublicationForAuthority(
      { workspaceId, userId },
      {
        publicationId: publication.id,
        confirmation: {
          expectedVersion: publication.version,
          confirmation: "PUBLISH",
          publicDisclosureAcknowledged: true,
          privateSourceAcknowledged: false,
          idempotencyKey: "phase5-public-key-0001",
        },
      },
    );
    const view = await (
      await import("@/lib/publishing/publication-service")
    ).getPublicPublicationBySlug(publication.slug);
    expect(published.revision.visibility).toBe("PUBLIC");
    expect(view?.claims[0].aiAssistedDisclosure).toContain(
      "reviewed and verified by the author",
    );
    expect(view?.claims[0].evidence[0].sourceUrl).toBe(
      "https://github.com/public-owner/public-repository/releases/tag/v1",
    );
    expect(view?.claims[0].evidence[0].confidence).toBe("FACT");
  });

  it("keeps UNLISTED projects out of public profile indexes", async () => {
    const { getPublicProfileBySlug } =
      await import("@/lib/publishing/profile-service");
    const profile = await getPublicProfileBySlug("phase5-owner");
    expect(profile?.projects.map((project) => project.slug)).toContain(
      "public-release-story",
    );
    expect(profile?.projects.map((project) => project.slug)).not.toContain(
      "private-release-story",
    );
  });

  it("rejects a public evidence URL that does not match its source type", async () => {
    const canonicalUrl =
      "https://github.com/public-owner/public-repository/releases/tag/v1";
    await prisma.repositoryEvidence.update({
      where: { id: publicEvidenceId },
      data: {
        canonicalUrl:
          "https://github.com/public-owner/public-repository/issues/95005",
      },
    });
    const { createPublicationDraftForAuthority } =
      await import("@/lib/publishing/publication-service");
    await expect(
      createPublicationDraftForAuthority(
        { workspaceId, userId },
        {
          ...publicPublicationInput(),
          slug: "invalid-public-source-url",
        },
      ),
    ).rejects.toThrow("PUBLIC_EVIDENCE_URL_INVALID");
    await prisma.repositoryEvidence.update({
      where: { id: publicEvidenceId },
      data: { canonicalUrl },
    });
  });

  it("marks changed evidence for review without rewriting public snapshots", async () => {
    await prisma.repositoryEvidence.update({
      where: { id: publicEvidenceId },
      data: { normalizedContentHash: "f".repeat(64) },
    });
    const publicPublication = await prisma.projectPublication.findUniqueOrThrow(
      {
        where: { slug: "public-release-story" },
      },
    );
    const { refreshPublicationHealthForAuthority } =
      await import("@/lib/publishing/health-service");
    const health = await refreshPublicationHealthForAuthority(
      { workspaceId, userId },
      publicPublication.id,
    );
    expect(health.health).toBe("REVIEW_REQUIRED");
    const persisted = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicPublication.id },
    });
    expect(persisted.status).toBe("PUBLISHED");
  });

  it.each([
    ["CASE_STUDY", "case study"],
    ["CV_BULLETS", "CV bullets"],
    ["INTERVIEW_STORY", "interview story"],
  ] as const)(
    "builds deterministic %s revisions and safe downloads",
    async (type, title) => {
      const { buildPrivateOutputDownload, createPortfolioOutputForAuthority } =
        await import("@/lib/portfolio/output-service");
      const output = await createPortfolioOutputForAuthority(
        { workspaceId, userId },
        {
          trackedRepositoryId: privateRepositoryId,
          type,
          title,
          fields: {
            projectTitle: "Private release",
            overview: "A user-authored overview.",
            context: "A user-authored context.",
            role: "Maintainer",
            approach: "A user-authored approach.",
            outcomes: "A supported outcome.",
            learning: "A user-authored reflection.",
            limitations: "Private evidence remains private.",
            situation: "A release needed a safe evidence trail.",
            task: "Create the workflow.",
            action: "Implemented the reviewed workflow.",
            result: "The release workflow was recorded.",
            reflection: "Explicit disclosure matters.",
          },
          claims: [{ claimId: humanClaimId }],
        },
      );
      outputId = output.id;
      const txt = await buildPrivateOutputDownload(
        { workspaceId, userId },
        output.id,
        "txt",
      );
      const markdown = await buildPrivateOutputDownload(
        { workspaceId, userId },
        output.id,
        "md",
      );
      const json = await buildPrivateOutputDownload(
        { workspaceId, userId },
        output.id,
        "json",
      );
      expect(txt.headers["Cache-Control"]).toBe("private, no-store");
      expect(txt.headers["Content-Disposition"]).not.toMatch(/[\r\n]/);
      expect(markdown.body).toContain("# ");
      expect(JSON.parse(json.body).schemaVersion).toBe(1);
    },
  );

  it("rejects an output claim from another repository", async () => {
    const { createPortfolioOutputForAuthority } =
      await import("@/lib/portfolio/output-service");
    await expect(
      createPortfolioOutputForAuthority(
        { workspaceId, userId },
        {
          trackedRepositoryId: publicRepositoryId,
          type: "CV_BULLETS",
          title: "Cross-repository output",
          fields: {},
          claims: [{ claimId: humanClaimId }],
        },
      ),
    ).rejects.toThrow("PORTFOLIO_OUTPUT_CLAIM_INELIGIBLE");
  });

  it("denies cross-workspace output downloads", async () => {
    const { buildPrivateOutputDownload } =
      await import("@/lib/portfolio/output-service");
    await expect(
      buildPrivateOutputDownload(
        { workspaceId: otherWorkspaceId, userId: otherUserId },
        outputId,
        "txt",
      ),
    ).rejects.toThrow("PORTFOLIO_OUTPUT_NOT_FOUND");
  });

  it("preserves output revision one after an append-only update", async () => {
    const { updatePortfolioOutputForAuthority } =
      await import("@/lib/portfolio/output-service");
    const output = await prisma.portfolioOutput.findUniqueOrThrow({
      where: { id: outputId },
    });
    await updatePortfolioOutputForAuthority(
      { workspaceId, userId },
      {
        outputId,
        expectedVersion: output.version,
        output: {
          trackedRepositoryId: output.trackedRepositoryId,
          type: output.type,
          title: "Updated interview story",
          fields: {
            situation: "Updated user-authored situation.",
            task: "Updated task.",
            action: "Updated action.",
            result: "Updated supported result.",
            reflection: "Updated reflection.",
          },
          claims: [{ claimId: humanClaimId }],
        },
      },
    );
    const revisions = await prisma.portfolioOutputRevision.findMany({
      where: { outputId },
      orderBy: { revisionNumber: "asc" },
    });
    expect(revisions).toHaveLength(2);
    expect(revisions[0].revisionNumber).toBe(1);
    expect(revisions[1].revisionNumber).toBe(2);
    await expect(
      prisma.portfolioOutputRevision.update({
        where: { id: revisions[0].id },
        data: { renderedText: "mutated" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.portfolioOutputRevision.delete({
        where: { id: revisions[1].id },
      }),
    ).rejects.toThrow();
  });

  it("marks a changed source claim for review without rewriting its snapshot", async () => {
    const statement = "Implemented a reviewed private release workflow.";
    await prisma.evidenceClaim.update({
      where: { id: humanClaimId },
      data: { statement: "Changed after the public revision." },
    });
    const { refreshPublicationHealthForAuthority } =
      await import("@/lib/publishing/health-service");
    expect(
      (
        await refreshPublicationHealthForAuthority(
          { workspaceId, userId },
          publicationId,
        )
      ).health,
    ).toBe("REVIEW_REQUIRED");
    await prisma.evidenceClaim.update({
      where: { id: humanClaimId },
      data: { statement },
    });
    expect(
      (
        await refreshPublicationHealthForAuthority(
          { workspaceId, userId },
          publicationId,
        )
      ).health,
    ).toBe("CURRENT");
  });

  it("automatically unpublishes private-source publications on source loss", async () => {
    const unavailableAt = new Date();
    const { markPublicationEvidenceUnavailable } =
      await import("@/lib/publishing/health-service");
    await prisma.$transaction(async (tx) => {
      await tx.repositoryEvidence.update({
        where: { id: privateEvidenceId },
        data: {
          sourceAvailability: "UNAVAILABLE",
          sourceUnavailableAt: unavailableAt,
        },
      });
      await markPublicationEvidenceUnavailable(
        tx,
        [privateEvidenceId],
        unavailableAt,
      );
    });
    expect(
      await prisma.projectPublication.findUniqueOrThrow({
        where: { id: publicationId },
      }),
    ).toMatchObject({
      status: "UNPUBLISHED",
      healthState: "SOURCE_UNAVAILABLE",
    });
  });

  it("enforces immutable published profile slugs and hides every project route when private", async () => {
    const { getPublicProfileBySlug, savePublicProfileForAuthority } =
      await import("@/lib/publishing/profile-service");
    const { getPublicPublicationBySlug } =
      await import("@/lib/publishing/publication-service");
    let profile = await prisma.publicProfile.findUniqueOrThrow({
      where: { workspaceId },
    });
    await expect(
      savePublicProfileForAuthority(
        { workspaceId, userId },
        {
          slug: "replacement-profile",
          displayName: profile.displayName,
          headline: profile.headline,
          biography: profile.biography,
          visibility: "PUBLIC",
          expectedVersion: profile.version,
        },
      ),
    ).rejects.toThrow("PROFILE_SLUG_IMMUTABLE");
    profile = await savePublicProfileForAuthority(
      { workspaceId, userId },
      {
        slug: profile.slug,
        displayName: profile.displayName,
        headline: profile.headline,
        biography: profile.biography,
        visibility: "PRIVATE",
        expectedVersion: profile.version,
      },
    );
    expect(await getPublicProfileBySlug(profile.slug)).toBeNull();
    expect(await getPublicPublicationBySlug("public-release-story")).toBeNull();
    await savePublicProfileForAuthority(
      { workspaceId, userId },
      {
        slug: profile.slug,
        displayName: profile.displayName,
        headline: profile.headline,
        biography: profile.biography,
        visibility: "PUBLIC",
        expectedVersion: profile.version,
      },
    );
  });

  it("rejects optimistic conflicts and supports archive then restore", async () => {
    const {
      archivePublicationForAuthority,
      restorePublicationForAuthority,
      updatePublicationDraftForAuthority,
    } = await import("@/lib/publishing/publication-service");
    await expect(
      updatePublicationDraftForAuthority(
        { workspaceId, userId },
        {
          publicationId,
          expectedVersion: 999,
          draft: privatePublicationInput(),
        },
      ),
    ).rejects.toThrow("PUBLICATION_VERSION_CONFLICT");
    let publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    await archivePublicationForAuthority(
      { workspaceId, userId },
      {
        publicationId,
        expectedVersion: publication.version,
        confirmation: "ARCHIVE",
      },
    );
    publication = await prisma.projectPublication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    expect(publication.status).toBe("ARCHIVED");
    await restorePublicationForAuthority(
      { workspaceId, userId },
      {
        publicationId,
        expectedVersion: publication.version,
      },
    );
    expect(
      (
        await prisma.projectPublication.findUniqueOrThrow({
          where: { id: publicationId },
        })
      ).status,
    ).toBe("UNPUBLISHED");
  });

  it("removes repository publications and outputs without orphaned public routes", async () => {
    const temporaryRepository = await prisma.trackedRepository.create({
      data: {
        workspaceId,
        githubRepositoryId: BigInt(95999),
        ownerLogin: "temporary",
        name: "temporary",
        fullName: "temporary/temporary",
        visibility: "private",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    await prisma.portfolioOutput.create({
      data: {
        workspaceId,
        trackedRepositoryId: temporaryRepository.id,
        type: "CV_BULLETS",
        title: "Temporary",
        draftFields: {},
      },
    });
    await prisma.trackedRepository.delete({
      where: { id: temporaryRepository.id },
    });
    expect(
      await prisma.portfolioOutput.count({
        where: { trackedRepositoryId: temporaryRepository.id },
      }),
    ).toBe(0);
  });

  it("keeps retired slugs reserved after account deletion", async () => {
    const reservation = await prisma.publicSlugReservation.findUniqueOrThrow({
      where: { slug: "phase5-owner" },
    });
    await prisma.$transaction(async (tx) => {
      await tx.projectPublication.updateMany({
        where: { workspaceId },
        data: { currentPublishedRevisionId: null },
      });
      await tx.projectPublication.deleteMany({ where: { workspaceId } });
      await tx.portfolioOutput.updateMany({
        where: { workspaceId },
        data: { currentRevisionId: null },
      });
      await tx.portfolioOutput.deleteMany({ where: { workspaceId } });
      await tx.publicProfile.deleteMany({ where: { workspaceId } });
      await tx.user.delete({ where: { id: userId } });
    });
    expect(
      await prisma.publicProfile.findUnique({ where: { workspaceId } }),
    ).toBeNull();
    expect(
      await prisma.projectPublication.count({ where: { workspaceId } }),
    ).toBe(0);
    expect(await prisma.portfolioOutput.count({ where: { workspaceId } })).toBe(
      0,
    );
    expect(
      await prisma.publicSlugReservation.findUnique({
        where: { id: reservation.id },
      }),
    ).not.toBeNull();
  });

  function privatePublicationInput() {
    return {
      trackedRepositoryId: privateRepositoryId,
      slug: "private-release-story",
      internalTitle: "Private release story",
      title: "Private release story",
      summary: "A reviewed release workflow with redacted private evidence.",
      roleText: "Maintainer",
      projectPeriodText: "2026",
      technologyLabels: ["TypeScript", "PostgreSQL"],
      problemText: "Private evidence needed deliberate disclosure.",
      approachText: "Built a reviewed evidence trail.",
      outcomeText: "The release workflow was recorded without source leakage.",
      repositoryDisclosurePolicy: "IDENTITY_REDACTED",
      visibility: "UNLISTED",
      claims: [
        {
          claimId: humanClaimId,
          evidence: [
            {
              repositoryEvidenceId: privateEvidenceId,
              mode: "PRIVATE_SOURCE_REDACTED",
              publicTitle: "Private release evidence",
              includeOccurredAt: false,
            },
          ],
        },
      ],
    };
  }

  function publicPublicationInput() {
    return {
      trackedRepositoryId: publicRepositoryId,
      slug: "public-release-story",
      internalTitle: "Public release story",
      title: "Public release story",
      summary: "A reviewed public release with a validated source.",
      roleText: "Maintainer",
      projectPeriodText: "2026",
      technologyLabels: ["TypeScript"],
      problemText: "Release evidence needed an honest public trail.",
      approachText: "Selected a verified claim and explicit source disclosure.",
      outcomeText: "The immutable revision links to the public GitHub source.",
      repositoryDisclosurePolicy: "PUBLIC_REPOSITORY",
      visibility: "PUBLIC",
      claims: [
        {
          claimId: aiClaimId,
          evidence: [
            {
              repositoryEvidenceId: publicEvidenceId,
              mode: "PUBLIC_SOURCE",
              publicTitle: "Release v1",
              includeOccurredAt: true,
            },
          ],
        },
      ],
    };
  }
});
