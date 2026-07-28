import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const outputArgument = process.argv[2];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const timestamp = new Date().toISOString().replaceAll(":", "-");
const outputPath = resolve(
  outputArgument ?? `backups/committrail-${timestamp}.backup`,
);

if (!basename(outputPath).endsWith(".backup")) {
  throw new Error("Backup output must use the .backup extension.");
}

await mkdir(dirname(outputPath), { recursive: true });

const child = spawn(
  "pg_dump",
  [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    outputPath,
    databaseUrl,
  ],
  { stdio: "inherit", windowsHide: true },
);

const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", resolveExit);
});

if (exitCode !== 0) {
  throw new Error(`pg_dump exited with code ${exitCode}.`);
}

console.log(`Backup written to ${outputPath}.`);
