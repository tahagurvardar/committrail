import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const { requireOwnerMock } = vi.hoisted(() => ({
  requireOwnerMock: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireWorkspaceOwner: requireOwnerMock,
}));

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe.sequential : describe.skip;

suite("Phase 3 PostgreSQL queue and evidence graph", () => {
  let prisma: PrismaClient;
  let workspaceId: string;
  let userId: string;
  let installationRecordId: string;
  let repositoryId: string;
  let evidenceId: string;

  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      !/test/i.test(new URL(process.env.TEST_DATABASE_URL).pathname)
    )
      throw new Error("A clearly named TEST_DATABASE_URL is required.");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    prisma = (await import("@/lib/db/prisma")).getPrisma();
    await prisma.user.deleteMany({
      where: { id: { startsWith: "phase3-" } },
    });
    userId = "phase3-owner";
    const user = await prisma.user.create({
      data: {
        id: userId,
        name: "Phase 3 Owner",
        email: "phase3-owner@example.test",
      },
    });
    const workspace = await prisma.workspace.create({
      data: {
        name: "Phase 3 workspace",
        slug: "phase3-workspace",
        ownerUserId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    workspaceId = workspace.id;
    const installation = await prisma.gitHubInstallation.create({
      data: {
        workspaceId,
        installationId: BigInt(93001),
        accountId: BigInt(93002),
        accountLogin: "phase3-owner",
        accountType: "User",
        repositorySelection: "SELECTED",
        permissions: {
          metadata: "read",
          contents: "read",
          issues: "read",
          pull_requests: "read",
          actions: "read",
        },
        verifiedAt: new Date(),
      },
    });
    installationRecordId = installation.id;
    const repository = await prisma.trackedRepository.create({
      data: {
        workspaceId,
        githubInstallationId: installation.id,
        githubRepositoryId: BigInt(93003),
        ownerLogin: "phase3-owner",
        name: "private-repo",
        fullName: "phase3-owner/private-repo",
        visibility: "private",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    repositoryId = repository.id;
    const evidence = await prisma.repositoryEvidence.create({
      data: {
        trackedRepositoryId: repository.id,
        evidenceId: "github:release:93004",
        evidenceType: "release",
        githubSourceId: "93004",
        canonicalUrl:
          "https://github.com/phase3-owner/private-repo/releases/tag/v1",
        occurredAt: new Date("2026-07-28T00:00:00Z"),
        title: "Release v1",
        factualPayload: { tagName: "v1" },
        normalizedContentHash: "a".repeat(64),
      },
    });
    evidenceId = evidence.id;
    requireOwnerMock.mockResolvedValue({
      workspace,
      session: { user },
    });
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: { id: { startsWith: "phase3-" } },
    });
    await prisma?.$disconnect();
  });

  it("deduplicates delivery IDs and coalesces active source jobs", async () => {
    const { persistVerifiedWebhook } =
      await import("@/lib/webhooks/persistence");
    const base = {
      event: "pull_request",
      bodyByteCount: 256,
      payloadSha256: "b".repeat(64),
      parsedBody: {
        action: "opened",
        installation: { id: 93001 },
        repository: {
          id: 93003,
          name: "private-repo",
          owner: { login: "phase3-owner" },
        },
        pull_request: {
          id: 93005,
          body: "private body that must not be retained",
        },
      },
    };
    const first = await persistVerifiedWebhook({
      ...base,
      githubDeliveryId: "phase3-delivery-1",
    });
    const duplicate = await persistVerifiedWebhook({
      ...base,
      githubDeliveryId: "phase3-delivery-1",
    });
    const coalesced = await persistVerifiedWebhook({
      ...base,
      githubDeliveryId: "phase3-delivery-2",
      parsedBody: {
        ...(base.parsedBody as Record<string, unknown>),
        action: "edited",
      },
    });
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(coalesced.duplicate).toBe(false);
    expect(
      await prisma.webhookDelivery.count({
        where: { githubDeliveryId: { startsWith: "phase3-delivery-" } },
      }),
    ).toBe(2);
    expect(
      await prisma.ingestionJob.count({
        where: {
          trackedRepositoryId: repositoryId,
          kind: "PULL_REQUESTS",
          status: { in: ["PENDING", "RUNNING"] },
        },
      }),
    ).toBe(1);
    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
      where: { githubDeliveryId: "phase3-delivery-1" },
    });
    expect(delivery.duplicateCount).toBe(1);
    expect(
      JSON.stringify(delivery, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toContain("private body");
    const job = await prisma.ingestionJob.findFirstOrThrow({
      where: { trackedRepositoryId: repositoryId, kind: "PULL_REQUESTS" },
    });
    expect(JSON.stringify(job.minimalPayload)).not.toContain("private body");
  });

  it("records unknown, untracked, and non-default events as ignored", async () => {
    const { persistVerifiedWebhook } =
      await import("@/lib/webhooks/persistence");
    for (const [delivery, event, parsedBody] of [
      [
        "phase3-ignored-unknown",
        "star",
        {
          action: "created",
          installation: { id: 93001 },
          repository: { id: 93003 },
        },
      ],
      [
        "phase3-ignored-untracked",
        "issues",
        {
          action: "opened",
          installation: { id: 93001 },
          repository: { id: 999999 },
          issue: { id: 1 },
        },
      ],
      [
        "phase3-ignored-branch",
        "push",
        {
          installation: { id: 93001 },
          repository: { id: 93003 },
          ref: "refs/heads/feature",
        },
      ],
    ] as const) {
      const result = await persistVerifiedWebhook({
        githubDeliveryId: delivery,
        event,
        bodyByteCount: 100,
        payloadSha256: "c".repeat(64),
        parsedBody,
      });
      expect(result.ignored).toBe(true);
    }
    const ignored = await prisma.webhookDelivery.findMany({
      where: { githubDeliveryId: { startsWith: "phase3-ignored-" } },
    });
    expect(ignored).toHaveLength(3);
    expect(ignored.every((item) => item.status === "IGNORED")).toBe(true);
  });

  it("enforces the partial active-job uniqueness rule", async () => {
    const data = {
      workspaceId,
      trackedRepositoryId: repositoryId,
      githubInstallationId: installationRecordId,
      kind: "COMMITS" as const,
      deduplicationKey: `${repositoryId}:partial-index-test`,
      minimalPayload: {},
    };
    await prisma.ingestionJob.create({ data });
    await expect(prisma.ingestionJob.create({ data })).rejects.toThrow();
    await prisma.ingestionJob.updateMany({
      where: { deduplicationKey: data.deduplicationKey },
      data: { status: "SUCCEEDED", completedAt: new Date() },
    });
    await expect(prisma.ingestionJob.create({ data })).resolves.toBeTruthy();
  });

  it("claims unrelated jobs with SKIP LOCKED and bounded leases", async () => {
    const { claimIngestionJobs, INGESTION_LEASE_MS } =
      await import("@/lib/ingestion/worker");
    const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
      import("@prisma/adapter-pg"),
      import("@/generated/prisma/client"),
    ]);
    await prisma.ingestionJob.updateMany({
      where: { workspaceId, status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    for (const suffix of ["a", "b"]) {
      await prisma.ingestionJob.create({
        data: {
          workspaceId,
          trackedRepositoryId: repositoryId,
          githubInstallationId: installationRecordId,
          kind: "ISSUES",
          deduplicationKey: `${repositoryId}:claim-${suffix}`,
          minimalPayload: {},
          availableAt: new Date("2026-07-28T00:00:00Z"),
        },
      });
    }
    const now = new Date("2026-07-28T01:00:00Z");
    const connectionString = process.env.TEST_DATABASE_URL!;
    const leftDatabase = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    const rightDatabase = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    try {
      const [left, right] = await Promise.all([
        claimIngestionJobs({
          workerId: "worker-a",
          batchSize: 1,
          now,
          database: leftDatabase,
        }),
        claimIngestionJobs({
          workerId: "worker-b",
          batchSize: 1,
          now,
          database: rightDatabase,
        }),
      ]);
      expect(left).toHaveLength(1);
      expect(right).toHaveLength(1);
      expect(left[0].id).not.toBe(right[0].id);
      expect(left[0].leaseExpiresAt?.getTime()).toBe(
        now.getTime() + INGESTION_LEASE_MS,
      );
    } finally {
      await Promise.all([
        leftDatabase.$disconnect(),
        rightDatabase.$disconnect(),
      ]);
    }
  });

  it("reclaims an expired lease after worker restart", async () => {
    const { claimIngestionJobs } = await import("@/lib/ingestion/worker");
    const expired = await prisma.ingestionJob.create({
      data: {
        workspaceId,
        trackedRepositoryId: repositoryId,
        githubInstallationId: installationRecordId,
        kind: "RELEASES",
        status: "RUNNING",
        deduplicationKey: `${repositoryId}:expired`,
        minimalPayload: {},
        attemptCount: 1,
        leaseOwner: "stopped-worker",
        leaseExpiresAt: new Date("2026-07-28T00:00:00Z"),
      },
    });
    const claimed = await claimIngestionJobs({
      workerId: "replacement-worker",
      batchSize: 10,
      now: new Date("2026-07-28T02:00:00Z"),
    });
    expect(claimed.some((item) => item.id === expired.id)).toBe(true);
    const recovered = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: expired.id },
    });
    expect(recovered.leaseOwner).toBe("replacement-worker");
    expect(recovered.attemptCount).toBe(2);
  });

  it("creates, links, verifies, edits, unlinks, archives, and restores claims", async () => {
    const service = await import("@/lib/claims/service");
    const created = await service.createClaim({
      trackedRepositoryId: repositoryId,
      statement: "  Shipped a durable ingestion queue. ",
    });
    expect(created.status).toBe("NEEDS_EVIDENCE");
    await expect(
      service.verifyClaim({ claimId: created.id, expectedVersion: 1 }),
    ).rejects.toThrow("CLAIM_EVIDENCE_REQUIRED");
    const linked = await service.linkClaimEvidence({
      claimId: created.id,
      repositoryEvidenceId: evidenceId,
      expectedVersion: 1,
    });
    expect(linked.status).toBe("DRAFT");
    const verified = await service.verifyClaim({
      claimId: created.id,
      expectedVersion: 2,
    });
    expect(verified.status).toBe("VERIFIED");
    const edited = await service.editClaim({
      claimId: created.id,
      statement: "Shipped an idempotent durable ingestion queue.",
      expectedVersion: 3,
    });
    expect(edited.status).toBe("DRAFT");
    expect(edited.verifiedAt).toBeNull();
    await expect(
      service.editClaim({
        claimId: created.id,
        statement: "stale edit",
        expectedVersion: 3,
      }),
    ).rejects.toThrow("CLAIM_VERSION_CONFLICT");
    const unlinked = await service.unlinkClaimEvidence({
      claimId: created.id,
      repositoryEvidenceId: evidenceId,
      expectedVersion: 4,
    });
    expect(unlinked.status).toBe("NEEDS_EVIDENCE");
    const archived = await service.archiveClaim({
      claimId: created.id,
      expectedVersion: 5,
    });
    expect(archived.status).toBe("ARCHIVED");
    const restored = await service.restoreClaim({
      claimId: created.id,
      expectedVersion: 6,
    });
    expect(restored.status).toBe("NEEDS_EVIDENCE");
    expect(
      await prisma.claimRevision.count({ where: { claimId: created.id } }),
    ).toBe(7);
    expect(
      await prisma.auditEvent.count({
        where: {
          workspaceId,
          metadata: { path: ["claimId"], equals: created.id },
        },
      }),
    ).toBe(7);
  });

  it("enforces same-repository claim evidence at the database boundary", async () => {
    const otherRepository = await prisma.trackedRepository.create({
      data: {
        workspaceId,
        githubInstallationId: installationRecordId,
        githubRepositoryId: BigInt(93009),
        ownerLogin: "phase3-owner",
        name: "other",
        fullName: "phase3-owner/other",
        visibility: "private",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    const otherEvidence = await prisma.repositoryEvidence.create({
      data: {
        trackedRepositoryId: otherRepository.id,
        evidenceId: "github:issue:other",
        evidenceType: "issue",
        githubSourceId: "999",
        canonicalUrl: "https://github.com/phase3-owner/other/issues/1",
        occurredAt: new Date(),
        title: "Other repository issue",
        factualPayload: {},
      },
    });
    const claim = await prisma.evidenceClaim.create({
      data: {
        workspaceId,
        trackedRepositoryId: repositoryId,
        authorUserId: userId,
        statement: "Repository-scoped claim",
      },
    });
    await expect(
      prisma.claimEvidence.create({
        data: {
          claimId: claim.id,
          repositoryEvidenceId: otherEvidence.id,
          trackedRepositoryId: repositoryId,
          linkedByUserId: userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("deduplicates append-only observations and stores no token fields", async () => {
    const evidence = await prisma.repositoryEvidence.findUniqueOrThrow({
      where: { id: evidenceId },
    });
    const data = {
      repositoryEvidenceId: evidence.id,
      sourceKind: "WEBHOOK" as const,
      observedAt: new Date(),
      normalizedContentHash: evidence.normalizedContentHash,
      deduplicationKey: `${evidence.id}:webhook:test`,
    };
    await prisma.evidenceObservation.create({ data });
    await expect(prisma.evidenceObservation.create({ data })).rejects.toThrow();
    const jobColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'IngestionJob'
    `;
    expect(jobColumns.map((item) => item.column_name)).not.toEqual(
      expect.arrayContaining(["token", "authorization", "privateKey"]),
    );
  });
});
