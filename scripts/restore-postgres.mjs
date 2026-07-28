import { resolve } from "node:path";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const inputArgument = process.argv.find((argument) =>
  argument.endsWith(".backup"),
);
const apply = process.argv.includes("--apply");

if (!databaseUrl || !inputArgument) {
  throw new Error(
    "DATABASE_URL and an explicit .backup input path are required.",
  );
}

if (!apply || process.env.COMMITTRAIL_ALLOW_RESTORE !== "yes") {
  throw new Error(
    "Restore is destructive. Pass --apply and set COMMITTRAIL_ALLOW_RESTORE=yes.",
  );
}

const inputPath = resolve(inputArgument);

const child = spawn(
  "pg_restore",
  [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--dbname",
    databaseUrl,
    inputPath,
  ],
  { stdio: "inherit", windowsHide: true },
);

const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", resolveExit);
});

if (exitCode !== 0) {
  throw new Error(`pg_restore exited with code ${exitCode}.`);
}

console.log(`Restore completed from ${inputPath}. Run npm run db:verify next.`);
