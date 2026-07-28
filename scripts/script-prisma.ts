import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

export function createScriptPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_CONFIGURATION_UNAVAILABLE");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}
