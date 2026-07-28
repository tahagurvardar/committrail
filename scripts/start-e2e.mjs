import { spawn } from "node:child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl || !/test/i.test(new URL(testDatabaseUrl).pathname))
  throw new Error("E2E_REQUIRES_VALIDATED_TEST_DATABASE");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
await run(["run", "db:test:prepare"], {
  ...process.env,
  DATABASE_URL:
    "postgresql://unused:unused@127.0.0.1:5432/committrail_development_guard",
});
await run(["run", "dev"], {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
});

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    const forward = (signal) => child.kill(signal);
    process.once("SIGTERM", forward);
    process.once("SIGINT", forward);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGTERM", forward);
      process.removeListener("SIGINT", forward);
      if (code === 0) resolve();
      else reject(new Error(`E2E_PROCESS_EXIT_${code ?? signal ?? "UNKNOWN"}`));
    });
  });
}
