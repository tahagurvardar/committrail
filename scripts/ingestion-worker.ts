import "dotenv/config";
import {
  INGESTION_POLL_MS,
  runIngestionWorkerOnce,
} from "../src/lib/ingestion/worker";

const once = process.argv.includes("--once");
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

do {
  const result = await runIngestionWorkerOnce();
  if (once || stopping) break;
  if (result.claimed === 0)
    await new Promise((resolve) => setTimeout(resolve, INGESTION_POLL_MS));
} while (!stopping);
