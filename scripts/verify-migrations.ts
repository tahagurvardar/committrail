import "dotenv/config";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "../src/lib/db/prisma";

const root = process.cwd();
const migrationsRoot = path.join(root, "prisma", "migrations");
const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (migrations.length < 4) throw new Error("MIGRATION_CHAIN_INCOMPLETE");
if (new Set(migrations).size !== migrations.length)
  throw new Error("MIGRATION_NAMES_NOT_UNIQUE");

for (const migration of migrations) {
  const sql = await readFile(
    path.join(migrationsRoot, migration, "migration.sql"),
    "utf8",
  );
  if (!sql.trim()) throw new Error("EMPTY_MIGRATION");
}

const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };
if (
  Object.values(packageJson.scripts ?? {}).some((script) =>
    /\bdb\s+push\b/.test(script),
  )
)
  throw new Error("DB_PUSH_RELEASE_DEPENDENCY_FORBIDDEN");

execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "status"],
  { stdio: "inherit", env: process.env },
);

const prisma = getPrisma();
try {
  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'IngestionJob_active_deduplicationKey_key',
        'RepositoryEvidence_id_trackedRepositoryId_key',
        'ProjectPublication_slug_lower_key',
        'PublicProfile_slug_lower_key'
      )
  `;
  const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
    SELECT tgname
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'ProjectPublicationRevision_immutable',
        'PublicationClaimSnapshot_immutable',
        'PublicationEvidenceSnapshot_immutable',
        'PortfolioOutputRevision_immutable'
      )
  `;
  if (indexes.length !== 4 || triggers.length !== 4)
    throw new Error("CUSTOM_DATABASE_GUARDS_MISSING");
  process.stdout.write(
    `${JSON.stringify({
      migrations: migrations.length,
      indexes: indexes.length,
      immutableTriggers: triggers.length,
      status: "verified",
    })}\n`,
  );
} finally {
  await prisma.$disconnect();
}
