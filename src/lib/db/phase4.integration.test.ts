import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { DraftingError } from "@/lib/drafting/errors";
import { FixtureDraftProvider } from "@/lib/drafting/fixture-provider";

const { requireOwnerMock, getSessionMock, workspaceMock } = vi.hoisted(() => ({
  requireOwnerMock: vi.fn(),
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

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe.sequential : describe.skip;

suite("Phase 4 PostgreSQL grounded drafting and review", () => {
  let prisma: PrismaClient;
  let workspaceId: string;
  let userId: string;
  let installationId: string;
  let repositoryId: string;
  let evidenceId: string;
  let firstRequestId: string;
  let firstCandidateId: string;

  const provider = new FixtureDraftProvider((request) =>
    JSON.stringify({
      title: "Release milestone",
      sentences: [
        {
          text: "Release v1 was recorded with 1 asset.",
          evidenceIds: [request.evidenceBundle.evidence[0].id],
        },
      ],
      caveats: ["The selected evidence is a bounded recent sample."],
    }),
  );

  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      !/test/i.test(new URL(process.env.TEST_DATABASE_URL).pathname)
    )
      throw new Error("A clearly named TEST_DATABASE_URL is required.");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    prisma = (await import("@/lib/db/prisma")).getPrisma();
    await prisma.user.deleteMany({
      where: { id: { startsWith: "phase4-" } },
    });
    userId = "phase4-owner";
    const user = await prisma.user.create({
      data: {
        id: userId,
        name: "Phase 4 Owner",
        email: "phase4-owner@example.test",
      },
    });
    const workspace = await prisma.workspace.create({
      data: {
        name: "Phase 4 workspace",
        slug: "phase4-workspace",
        ownerUserId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    workspaceId = workspace.id;
    const installation = await prisma.gitHubInstallation.create({
      data: {
        workspaceId,
        installationId: BigInt(94001),
        accountId: BigInt(94002),
        accountLogin: "phase4-owner",
        accountType: "User",
        repositorySelection: "SELECTED",
        permissions: { metadata: "read", contents: "read" },
        verifiedAt: new Date(),
      },
    });
    installationId = installation.id;
    const repository = await prisma.trackedRepository.create({
      data: {
        workspaceId,
        githubInstallationId: installation.id,
        githubRepositoryId: BigInt(94003),
        ownerLogin: "phase4-owner",
        name: "private-repo",
        fullName: "phase4-owner/private-repo",
        visibility: "private",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    repositoryId = repository.id;
    const evidence = await prisma.repositoryEvidence.create({
      data: {
        trackedRepositoryId: repository.id,
        evidenceId: "github:release:94004",
        evidenceType: "release",
        githubSourceId: "94004",
        canonicalUrl:
          "https://github.com/phase4-owner/private-repo/releases/tag/v1",
        occurredAt: new Date("2026-07-28T00:00:00Z"),
        title: "Release v1",
        factualPayload: {
          tagName: "v1",
          releaseName: "Release v1",
          draft: false,
          prerelease: false,
          immutable: true,
          createdAt: "2026-07-28T00:00:00Z",
          publishedAt: "2026-07-28T00:00:00Z",
          assetCount: 1,
          body: "private release body",
        },
        normalizedContentHash: "a".repeat(64),
      },
    });
    evidenceId = evidence.id;
    requireOwnerMock.mockResolvedValue({
      workspace,
      session: { user },
    });
    getSessionMock.mockResolvedValue({ user });
    workspaceMock.mockResolvedValue(workspace);
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: { id: { startsWith: "phase4-" } },
    });
    await prisma?.$disconnect();
  });

  it("creates one idempotent active request and a durable draft job", async () => {
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    const input = {
      trackedRepositoryId: repositoryId,
      evidenceIds: [evidenceId],
      intent: "Describe the release milestone",
      style: "CONCISE",
    };
    const first = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      input,
      provider,
    );
    const duplicate = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      input,
      provider,
    );
    expect(duplicate.id).toBe(first.id);
    firstRequestId = first.id;
    const persisted = await prisma.draftGenerationRequest.findUniqueOrThrow({
      where: { id: first.id },
      include: { evidenceSelections: true, ingestionJob: true },
    });
    expect(persisted.evidenceSelections).toHaveLength(1);
    expect(persisted.ingestionJob?.kind).toBe("GROUNDED_DRAFT");
    expect(
      JSON.stringify(persisted.ingestionJob?.minimalPayload),
    ).not.toContain("private release body");
    await expect(
      prisma.draftGenerationRequest.create({
        data: {
          workspaceId,
          trackedRepositoryId: repositoryId,
          requestedByUserId: userId,
          providerKind: "FIXTURE",
          providerClassification: "LOCAL",
          providerIdentityHash: "b".repeat(64),
          modelLabel: "duplicate active",
          promptTemplateVersion: 1,
          evidenceBundleVersion: 1,
          evidenceBundleHash: "b".repeat(64),
          draftingIntent: "Another active request",
          style: "CONCISE",
          requestHash: "c".repeat(64),
          inputEvidenceCount: 1,
          inputByteCount: 1,
        },
      }),
    ).rejects.toThrow();
  });

  it("persists one immutable validated candidate with sentence citations", async () => {
    const { processIngestionJob } = await import("@/lib/ingestion/worker");
    const request = await prisma.draftGenerationRequest.findUniqueOrThrow({
      where: { id: firstRequestId },
      include: { ingestionJob: true },
    });
    if (!request.ingestionJob) throw new Error("Missing draft job.");
    await processIngestionJob(request.ingestionJob, {
      draftProvider: provider,
    });
    await processIngestionJob(request.ingestionJob, {
      draftProvider: provider,
    });
    const completed = await prisma.draftGenerationRequest.findUniqueOrThrow({
      where: { id: firstRequestId },
      include: {
        candidate: {
          include: {
            sentences: { include: { citations: true } },
          },
        },
      },
    });
    expect(completed.status).toBe("SUCCEEDED");
    expect(completed.candidate?.sentences).toHaveLength(1);
    expect(completed.candidate?.sentences[0].citations).toHaveLength(1);
    expect(
      await prisma.draftCandidate.count({
        where: { requestId: firstRequestId },
      }),
    ).toBe(1);
    expect(completed.outputByteCount).toBeGreaterThan(0);
    firstCandidateId = completed.candidate!.id;
  });

  it("accepts once into a non-verified AI-assisted claim and records human edits", async () => {
    const review = await import("@/lib/drafting/review-service");
    const claims = await import("@/lib/claims/service");
    const accepted = await review.acceptDraftCandidateAsNewClaim(
      firstCandidateId,
      repositoryId,
    );
    const repeated = await review.acceptDraftCandidateAsNewClaim(
      firstCandidateId,
      repositoryId,
    );
    expect(repeated.id).toBe(accepted.id);
    expect(accepted.status).toBe("DRAFT");
    expect(accepted.verifiedAt).toBeNull();
    const linked = await prisma.claimEvidence.findMany({
      where: { claimId: accepted.id },
    });
    expect(linked.map((item) => item.repositoryEvidenceId)).toEqual([
      evidenceId,
    ]);
    const edited = await claims.editClaim({
      claimId: accepted.id,
      statement: "Release v1 was reviewed as a private milestone.",
      expectedVersion: 1,
    });
    expect(edited.origin).toBe("AI_ASSISTED");
    expect(edited.humanEditedAfterAcceptance).toBe(true);
    const verified = await claims.verifyClaim({
      claimId: accepted.id,
      expectedVersion: 2,
    });
    expect(verified.status).toBe("VERIFIED");
    expect(
      await prisma.evidenceClaim.count({
        where: { origin: "AI_ASSISTED" },
      }),
    ).toBe(1);
  });

  it("rejects cross-repository evidence and unknown provider citations", async () => {
    const otherRepository = await prisma.trackedRepository.create({
      data: {
        workspaceId,
        githubInstallationId: installationId,
        githubRepositoryId: BigInt(94009),
        ownerLogin: "phase4-owner",
        name: "other",
        fullName: "phase4-owner/other",
        visibility: "private",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    const otherEvidence = await prisma.repositoryEvidence.create({
      data: {
        trackedRepositoryId: otherRepository.id,
        evidenceId: "github:issue:94010",
        evidenceType: "issue",
        githubSourceId: "94010",
        canonicalUrl: "https://github.com/phase4-owner/other/issues/1",
        occurredAt: new Date(),
        title: "Other repository issue",
        factualPayload: { number: 1, state: "open" },
        normalizedContentHash: "d".repeat(64),
      },
    });
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    await expect(
      requestDraftGenerationForAuthority(
        { workspaceId, userId },
        {
          trackedRepositoryId: repositoryId,
          evidenceIds: [otherEvidence.id],
          intent: "Cross repository",
          style: "CONCISE",
        },
        provider,
      ),
    ).rejects.toThrow("DRAFT_EVIDENCE_NOT_FOUND");

    const invalidProvider = new FixtureDraftProvider(() =>
      JSON.stringify({
        sentences: [
          { text: "Unsupported statement.", evidenceIds: ["unknown-id"] },
        ],
        caveats: [],
      }),
    );
    const regenerated = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      {
        trackedRepositoryId: repositoryId,
        evidenceIds: [evidenceId],
        intent: "Describe the release milestone",
        style: "CONCISE",
        regenerationOfId: firstRequestId,
      },
      invalidProvider,
    );
    expect(regenerated.regenerationOfId).toBe(firstRequestId);
    const job = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: regenerated.ingestionJobId! },
    });
    const { processIngestionJob } = await import("@/lib/ingestion/worker");
    await processIngestionJob(job, { draftProvider: invalidProvider });
    const failed = await prisma.draftGenerationRequest.findUniqueOrThrow({
      where: { id: regenerated.id },
      include: { candidate: true },
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.sanitizedErrorCode).toBe("DRAFT_OUTPUT_UNKNOWN_CITATION");
    expect(failed.candidate).toBeNull();
  });

  it("requeues retryable provider failures without creating a candidate", async () => {
    const retryingProvider = {
      descriptor: provider.descriptor,
      generate: async () => {
        throw new DraftingError("DRAFT_PROVIDER_TIMEOUT", {
          retryable: true,
        });
      },
    };
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    const request = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      {
        trackedRepositoryId: repositoryId,
        evidenceIds: [evidenceId],
        intent: "Describe the release milestone",
        style: "CONCISE",
        regenerationOfId: firstRequestId,
      },
      retryingProvider,
    );
    const job = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: request.ingestionJobId! },
    });
    const { processIngestionJob } = await import("@/lib/ingestion/worker");
    await processIngestionJob(job, { draftProvider: retryingProvider });
    const [queued, pendingJob] = await Promise.all([
      prisma.draftGenerationRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: { candidate: true },
      }),
      prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id } }),
    ]);
    expect(queued.status).toBe("QUEUED");
    expect(queued.candidate).toBeNull();
    expect(pendingJob.status).toBe("PENDING");
    expect(pendingJob.sanitizedLastErrorCode).toBe("DRAFT_PROVIDER_TIMEOUT");
    await prisma.$transaction([
      prisma.ingestionJob.update({
        where: { id: job.id },
        data: { status: "CANCELLED", completedAt: new Date() },
      }),
      prisma.draftGenerationRequest.update({
        where: { id: request.id },
        data: { status: "CANCELLED", completedAt: new Date() },
      }),
    ]);
  });

  it("preserves stale candidates, blocks acceptance, and records rejection history", async () => {
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    const regenerated = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      {
        trackedRepositoryId: repositoryId,
        evidenceIds: [evidenceId],
        intent: "Describe the release milestone",
        style: "CONCISE",
        regenerationOfId: firstRequestId,
      },
      provider,
    );
    const job = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: regenerated.ingestionJobId! },
    });
    const { processIngestionJob } = await import("@/lib/ingestion/worker");
    await processIngestionJob(job, { draftProvider: provider });
    const generated = await prisma.draftGenerationRequest.findUniqueOrThrow({
      where: { id: regenerated.id },
      include: { candidate: true },
    });
    await prisma.repositoryEvidence.update({
      where: { id: evidenceId },
      data: { sourceAvailability: "DELETED", sourceUnavailableAt: new Date() },
    });
    const review = await import("@/lib/drafting/review-service");
    await expect(
      review.acceptDraftCandidateAsNewClaim(
        generated.candidate!.id,
        repositoryId,
      ),
    ).rejects.toThrow("DRAFT_CANDIDATE_STALE");
    const stale = await prisma.draftCandidate.findUniqueOrThrow({
      where: { id: generated.candidate!.id },
    });
    expect(stale.groundingStatus).toBe("STALE");
    await review.rejectDraftCandidate({
      candidateId: stale.id,
      trackedRepositoryId: repositoryId,
      reason: "Evidence changed.",
    });
    expect(
      await prisma.draftReviewEvent.count({
        where: { candidateId: stale.id, kind: "CANDIDATE_REJECTED" },
      }),
    ).toBe(1);
    await prisma.repositoryEvidence.update({
      where: { id: evidenceId },
      data: { sourceAvailability: "AVAILABLE", sourceUnavailableAt: null },
    });
  });

  it("replaces a verified claim while clearing verification and preserving provenance", async () => {
    const claims = await import("@/lib/claims/service");
    const human = await claims.createClaim({
      trackedRepositoryId: repositoryId,
      statement: "Human-authored release statement.",
    });
    await claims.linkClaimEvidence({
      claimId: human.id,
      repositoryEvidenceId: evidenceId,
      expectedVersion: 1,
    });
    await claims.verifyClaim({ claimId: human.id, expectedVersion: 2 });
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    const request = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      {
        trackedRepositoryId: repositoryId,
        evidenceIds: [evidenceId],
        intent: "Replace the reviewed claim",
        style: "TECHNICAL",
        regenerationOfId: firstRequestId,
      },
      provider,
    );
    const job = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: request.ingestionJobId! },
    });
    const { processIngestionJob } = await import("@/lib/ingestion/worker");
    await processIngestionJob(job, { draftProvider: provider });
    const candidate = await prisma.draftCandidate.findUniqueOrThrow({
      where: { requestId: request.id },
    });
    const review = await import("@/lib/drafting/review-service");
    const replaced = await review.acceptDraftCandidateIntoClaim({
      candidateId: candidate.id,
      trackedRepositoryId: repositoryId,
      claimId: human.id,
      expectedVersion: 3,
    });
    expect(replaced.status).toBe("DRAFT");
    expect(replaced.verifiedAt).toBeNull();
    expect(replaced.origin).toBe("AI_ASSISTED");
    expect(replaced.humanEditedAfterAcceptance).toBe(false);
  });

  it("enforces the five-request rolling user limit in PostgreSQL", async () => {
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    await expect(
      requestDraftGenerationForAuthority(
        { workspaceId, userId },
        {
          trackedRepositoryId: repositoryId,
          evidenceIds: [evidenceId],
          intent: "Another explicit regeneration",
          style: "CONCISE",
          regenerationOfId: firstRequestId,
        },
        provider,
      ),
    ).rejects.toThrow("DRAFT_USER_RATE_LIMITED");
    await prisma.draftGenerationRequest.updateMany({
      where: { workspaceId, requestedByUserId: userId },
      data: { createdAt: new Date(Date.now() - 11 * 60 * 1000) },
    });
  });

  it("rejects evidence changed before the provider call", async () => {
    const generate = vi.fn(provider.generate.bind(provider));
    const guardedProvider = { descriptor: provider.descriptor, generate };
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    const request = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      {
        trackedRepositoryId: repositoryId,
        evidenceIds: [evidenceId],
        intent: "Check the evidence version before drafting",
        style: "CONCISE",
        regenerationOfId: firstRequestId,
      },
      guardedProvider,
    );
    await prisma.repositoryEvidence.update({
      where: { id: evidenceId },
      data: { normalizedContentHash: "e".repeat(64) },
    });
    const job = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: request.ingestionJobId! },
    });
    const { processIngestionJob } = await import("@/lib/ingestion/worker");
    await processIngestionJob(job, { draftProvider: guardedProvider });
    const failed = await prisma.draftGenerationRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: { candidate: true },
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.sanitizedErrorCode).toBe("DRAFT_EVIDENCE_CHANGED");
    expect(failed.candidate).toBeNull();
    expect(generate).not.toHaveBeenCalled();
    await prisma.repositoryEvidence.update({
      where: { id: evidenceId },
      data: { normalizedContentHash: "a".repeat(64) },
    });
  });

  it("denies cross-user candidate access", async () => {
    const otherUser = await prisma.user.create({
      data: {
        id: "phase4-other-user",
        name: "Other user",
        email: "phase4-other@example.test",
      },
    });
    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: "Other workspace",
        slug: "phase4-other-workspace",
        ownerUserId: otherUser.id,
        members: { create: { userId: otherUser.id, role: "OWNER" } },
      },
    });
    requireOwnerMock.mockResolvedValueOnce({
      workspace: otherWorkspace,
      session: { user: otherUser },
    });
    const review = await import("@/lib/drafting/review-service");
    await expect(
      review.rejectDraftCandidate({
        candidateId: firstCandidateId,
        trackedRepositoryId: repositoryId,
        reason: "Unauthorized",
      }),
    ).rejects.toThrow("DRAFT_CANDIDATE_NOT_FOUND");
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    requireOwnerMock.mockResolvedValue({
      workspace,
      session: { user: owner },
    });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it("keeps exact external consent history", async () => {
    const original = {
      provider: process.env.DRAFT_PROVIDER,
      baseUrl: process.env.DRAFT_PROVIDER_BASE_URL,
      model: process.env.DRAFT_PROVIDER_MODEL,
    };
    process.env.DRAFT_PROVIDER = "openai-compatible";
    process.env.DRAFT_PROVIDER_BASE_URL = "https://models.example.test/v1";
    process.env.DRAFT_PROVIDER_MODEL = "configured-model";
    const consent = await import("@/lib/drafting/consent-service");
    const { getDraftProviderConfig } = await import("@/lib/drafting/config");
    const providerConfig = getDraftProviderConfig();
    if (providerConfig.mode !== "openai-compatible")
      throw new Error("Expected an external provider configuration.");
    const externalGenerate = vi.fn(async () => {
      throw new Error("External provider must not be called after revocation.");
    });
    const externalProvider = {
      descriptor: providerConfig.descriptor,
      generate: externalGenerate,
    };
    await consent.grantCurrentDraftingConsent();
    const { requestDraftGenerationForAuthority } =
      await import("@/lib/drafting/service");
    const request = await requestDraftGenerationForAuthority(
      { workspaceId, userId },
      {
        trackedRepositoryId: repositoryId,
        evidenceIds: [evidenceId],
        intent: "Check consent again in the worker",
        style: "CONCISE",
        regenerationOfId: firstRequestId,
      },
      externalProvider,
    );
    await consent.revokeCurrentDraftingConsent();
    const job = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: request.ingestionJobId! },
    });
    const { processIngestionJob } = await import("@/lib/ingestion/worker");
    await processIngestionJob(job, { draftProvider: externalProvider });
    expect(externalGenerate).not.toHaveBeenCalled();
    expect(
      await prisma.draftGenerationRequest.findUniqueOrThrow({
        where: { id: request.id },
      }),
    ).toMatchObject({
      status: "FAILED",
      sanitizedErrorCode: "DRAFT_EXTERNAL_CONSENT_REQUIRED",
    });
    await expect(
      requestDraftGenerationForAuthority(
        { workspaceId, userId },
        {
          trackedRepositoryId: repositoryId,
          evidenceIds: [evidenceId],
          intent: "Blocked while consent is revoked",
          style: "CONCISE",
        },
        externalProvider,
      ),
    ).rejects.toThrow("DRAFT_EXTERNAL_CONSENT_REQUIRED");
    await consent.grantCurrentDraftingConsent();
    expect(
      await prisma.workspaceDraftingConsent.count({
        where: { workspaceId },
      }),
    ).toBe(2);
    expect(
      await prisma.workspaceDraftingConsent.count({
        where: { workspaceId, revokedAt: null },
      }),
    ).toBe(1);
    restore("DRAFT_PROVIDER", original.provider);
    restore("DRAFT_PROVIDER_BASE_URL", original.baseUrl);
    restore("DRAFT_PROVIDER_MODEL", original.model);
  });

  it("exports only validated drafting state and redacts transient provider data", async () => {
    const { GET } = await import("@/app/api/export/route");
    const response = await GET(
      new Request("http://localhost/api/export", {
        headers: { cookie: "test-session=opaque" },
      }),
    );
    expect(response.status).toBe(200);
    const exported = await response.json();
    expect(exported.version).toBe(4);
    expect(exported.workspace.draftingConsents).toHaveLength(2);
    expect(exported.workspace.draftGenerationRequests.length).toBeGreaterThan(
      0,
    );
    const serialized = JSON.stringify(exported);
    const draftingSerialized = JSON.stringify(
      exported.workspace.draftGenerationRequests,
    );
    expect(serialized).not.toContain("DRAFT_PROVIDER_API_KEY");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("chainOfThought");
    expect(draftingSerialized).not.toContain("private release body");
  });

  it("cascades repository drafting data on disconnect and consent on account deletion", async () => {
    await prisma.gitHubInstallation.delete({ where: { id: installationId } });
    expect(
      await prisma.draftGenerationRequest.count({ where: { workspaceId } }),
    ).toBe(0);
    expect(await prisma.evidenceClaim.count({ where: { workspaceId } })).toBe(
      0,
    );
    expect(
      await prisma.workspaceDraftingConsent.count({ where: { workspaceId } }),
    ).toBe(2);
    await prisma.user.delete({ where: { id: userId } });
    expect(
      await prisma.workspaceDraftingConsent.count({ where: { workspaceId } }),
    ).toBe(0);
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
