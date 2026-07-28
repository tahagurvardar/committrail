import "dotenv/config";
import {
  INGESTION_POLL_MS,
  runIngestionWorkerOnce,
} from "../src/lib/ingestion/worker";
import { getPrisma } from "../src/lib/db/prisma";
import { logEvent } from "../src/lib/operations/logger";

const once = process.argv.includes("--once");
let stopping = false;
let shutdownTimer: NodeJS.Timeout | undefined;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    logEvent("info", "worker.shutdown.requested", { signal });
    shutdownTimer = setTimeout(() => {
      logEvent("error", "worker.shutdown.timeout", { signal });
      process.exit(1);
    }, 30_000);
    shutdownTimer.unref();
  });
}

try {
  logEvent("info", "worker.started", { mode: once ? "once" : "continuous" });
  do {
    if (stopping) break;
    const result = await runIngestionWorkerOnce();
    if (once || stopping) break;
    if (result.claimed === 0)
      await new Promise((resolve) => setTimeout(resolve, INGESTION_POLL_MS));
  } while (!stopping);
  logEvent("info", "worker.stopped", { graceful: true });
} catch {
  logEvent("error", "worker.startup.failure", {
    code: "WORKER_UNRECOVERABLE_FAILURE",
  });
  process.exitCode = 1;
} finally {
  if (shutdownTimer) clearTimeout(shutdownTimer);
  await getPrisma().$disconnect();
}
