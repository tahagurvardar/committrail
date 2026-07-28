import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("Phase 6 authentication persistence", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      !/test/i.test(new URL(process.env.TEST_DATABASE_URL).pathname)
    )
      throw new Error("A clearly named TEST_DATABASE_URL is required.");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const prismaModule = await import("@/lib/db/prisma");
    prisma = prismaModule.getPrisma();
    await prisma.rateLimit.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("persists one Better Auth counter per opaque key", async () => {
    await prisma.rateLimit.create({
      data: {
        id: "phase6-rate-limit",
        key: "fixture:sign-up",
        count: 1,
        lastRequest: BigInt(1_722_427_200_000),
      },
    });
    await expect(
      prisma.rateLimit.create({
        data: {
          id: "phase6-rate-limit-duplicate",
          key: "fixture:sign-up",
          count: 1,
          lastRequest: BigInt(1_722_427_200_000),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
