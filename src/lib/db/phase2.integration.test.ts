import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("Phase 2 PostgreSQL constraints", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      !/test/i.test(new URL(process.env.TEST_DATABASE_URL).pathname)
    ) {
      throw new Error("A clearly named TEST_DATABASE_URL is required.");
    }
    if (
      process.env.DATABASE_URL &&
      process.env.DATABASE_URL === process.env.TEST_DATABASE_URL
    ) {
      throw new Error(
        "Development and test database URLs must differ before reset.",
      );
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const prismaModule = await import("@/lib/db/prisma");
    prisma = prismaModule.getPrisma();
    await prisma.auditEvent.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("creates one personal workspace and enforces unique membership", async () => {
    const user = await prisma.user.create({
      data: {
        id: "integration-user",
        name: "Test",
        email: "test@example.test",
      },
    });
    const { ensurePersonalWorkspace } = await import("@/lib/auth/workspace");
    const first = await ensurePersonalWorkspace(user, prisma);
    const second = await ensurePersonalWorkspace(user, prisma);
    expect(second.id).toBe(first.id);
    expect(
      await prisma.workspaceMember.count({
        where: { workspaceId: first.id, userId: user.id },
      }),
    ).toBe(1);
  });

  it("upserts evidence idempotently and cascades account-owned data", async () => {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { ownerUserId: "integration-user" },
    });
    const repository = await prisma.trackedRepository.create({
      data: {
        workspaceId: workspace.id,
        githubRepositoryId: BigInt(99),
        ownerLogin: "private-owner",
        name: "private-repo",
        fullName: "private-owner/private-repo",
        visibility: "private",
        defaultBranch: "main",
        sourceType: "INSTALLATION",
      },
    });
    const where = {
      trackedRepositoryId_evidenceId: {
        trackedRepositoryId: repository.id,
        evidenceId: "github:commit:abc",
      },
    };
    await prisma.repositoryEvidence.upsert({
      where,
      create: {
        trackedRepositoryId: repository.id,
        evidenceId: "github:commit:abc",
        evidenceType: "commit",
        githubSourceId: "abc",
        canonicalUrl:
          "https://github.com/private-owner/private-repo/commit/abc",
        occurredAt: new Date(),
        title: "Safe title",
        factualPayload: {},
      },
      update: { title: "Safe title" },
    });
    await prisma.repositoryEvidence.upsert({
      where,
      create: {
        trackedRepositoryId: repository.id,
        evidenceId: "github:commit:abc",
        evidenceType: "commit",
        githubSourceId: "abc",
        canonicalUrl: "https://github.com/x",
        occurredAt: new Date(),
        title: "x",
        factualPayload: {},
      },
      update: { title: "Updated", lastSeenAt: new Date() },
    });
    expect(
      await prisma.repositoryEvidence.count({
        where: { trackedRepositoryId: repository.id },
      }),
    ).toBe(1);
    await prisma.user.delete({ where: { id: "integration-user" } });
    expect(
      await prisma.trackedRepository.count({ where: { id: repository.id } }),
    ).toBe(0);
  });
});
