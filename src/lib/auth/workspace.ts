import "server-only";

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export async function ensurePersonalWorkspace(
  user: { id: string; name: string; email: string },
  prisma: PrismaClient = getPrisma(),
) {
  const existing = await prisma.workspace.findUnique({
    where: { ownerUserId: user.id },
  });
  if (existing) return existing;

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  return prisma.$transaction(async (tx) => {
    const raced = await tx.workspace.findUnique({
      where: { ownerUserId: user.id },
    });
    if (raced) return raced;
    return tx.workspace.create({
      data: {
        name: `${user.name || user.email.split("@")[0]}'s workspace`,
        slug: `personal-${suffix}`,
        ownerUserId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
        auditEvents: {
          create: { userId: user.id, type: "account.registration" },
        },
      },
    });
  });
}
