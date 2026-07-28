import "dotenv/config";
import { getPrisma } from "../src/lib/db/prisma";

const command = process.argv[2] ?? "verify-invariants";
const apply = process.argv.includes("--apply");
const allowTest = process.argv.includes("--allow-test-database");
const prisma = getPrisma();

try {
  if (apply) assertWriteTarget(allowTest);
  switch (command) {
    case "inspect-queue":
      await inspectQueue();
      break;
    case "inspect-publication-health":
      await inspectPublicationHealth();
      break;
    case "recover-stale-jobs":
      await recoverStaleJobs();
      break;
    case "prune-expired":
      await pruneExpired();
      break;
    case "verify-invariants":
      await verifyInvariants();
      break;
    default:
      throw new Error("MAINTENANCE_COMMAND_UNKNOWN");
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "MAINTENANCE_FAILED"}\n`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function inspectQueue() {
  const groups = await prisma.ingestionJob.groupBy({
    by: ["status", "kind"],
    _count: true,
  });
  process.stdout.write(`${JSON.stringify({ command, groups })}\n`);
}

async function inspectPublicationHealth() {
  const groups = await prisma.projectPublication.groupBy({
    by: ["status", "healthState"],
    _count: true,
  });
  process.stdout.write(`${JSON.stringify({ command, groups })}\n`);
}

async function recoverStaleJobs() {
  const where = {
    status: "RUNNING" as const,
    leaseExpiresAt: { lt: new Date() },
  };
  const count = await prisma.ingestionJob.count({ where });
  const changed = apply
    ? (
        await prisma.ingestionJob.updateMany({
          where,
          data: {
            status: "PENDING",
            availableAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
            sanitizedLastErrorCode: "LEASE_EXPIRED_RECOVERED",
          },
        })
      ).count
    : 0;
  process.stdout.write(
    `${JSON.stringify({ command, dryRun: !apply, candidates: count, changed })}\n`,
  );
}

async function pruneExpired() {
  const now = new Date();
  const [attempts, sessions] = await Promise.all([
    prisma.gitHubConnectionAttempt.count({ where: { expiresAt: { lt: now } } }),
    prisma.session.count({ where: { expiresAt: { lt: now } } }),
  ]);
  const changed = apply
    ? await prisma.$transaction([
        prisma.gitHubConnectionAttempt.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      ])
    : [];
  process.stdout.write(
    `${JSON.stringify({
      command,
      dryRun: !apply,
      candidates: { connectionAttempts: attempts, sessions },
      changed: changed.map((result) => result.count),
    })}\n`,
  );
}

async function verifyInvariants() {
  const [publicationLinks, outputLinks, missingReservations] =
    await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "ProjectPublication" publication
        JOIN "ProjectPublicationRevision" revision
          ON revision."id" = publication."currentPublishedRevisionId"
        WHERE revision."publicationId" <> publication."id"
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "PortfolioOutput" output
        JOIN "PortfolioOutputRevision" revision
          ON revision."id" = output."currentRevisionId"
        WHERE revision."outputId" <> output."id"
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT profile."slug"
          FROM "PublicProfile" profile
          WHERE profile."firstPublishedAt" IS NOT NULL
          UNION
          SELECT publication."slug"
          FROM "ProjectPublication" publication
          WHERE publication."firstPublishedAt" IS NOT NULL
        ) published
        LEFT JOIN "PublicSlugReservation" reservation
          ON reservation."slug" = published."slug"
        WHERE reservation."id" IS NULL
      `,
    ]);
  const violations = {
    publicationCurrentRevision: Number(publicationLinks[0]?.count ?? 0),
    outputCurrentRevision: Number(outputLinks[0]?.count ?? 0),
    missingSlugReservations: Number(missingReservations[0]?.count ?? 0),
  };
  process.stdout.write(`${JSON.stringify({ command, violations })}\n`);
  if (Object.values(violations).some((value) => value > 0))
    throw new Error("DATABASE_INVARIANT_VIOLATION");
}

function assertWriteTarget(allowTestDatabase: boolean) {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_CONFIGURATION_UNAVAILABLE");
  const url = new URL(raw);
  if (/test/i.test(`${url.pathname}${url.search}`) && !allowTestDatabase)
    throw new Error("TEST_DATABASE_WRITE_REQUIRES_EXPLICIT_OVERRIDE");
  if (process.env.MAINTENANCE_ALLOW_WRITE !== "1")
    throw new Error("MAINTENANCE_ALLOW_WRITE_REQUIRED");
}
