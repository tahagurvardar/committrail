import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type PrismaGlobal = typeof globalThis & { __commitTrailPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  const globalWithPrisma = globalThis as PrismaGlobal;
  if (globalWithPrisma.__commitTrailPrisma)
    return globalWithPrisma.__commitTrailPrisma;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_CONFIGURATION_UNAVAILABLE");

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  if (process.env.NODE_ENV !== "production")
    globalWithPrisma.__commitTrailPrisma = client;
  return client;
}
