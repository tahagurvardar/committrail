import "dotenv/config";
import {
  validateConfiguration,
  type ConfigurationMode,
} from "../src/lib/config/validation";

const requested = (process.argv[2] ?? "local-full") as ConfigurationMode;
if (
  !["public-demo", "local-full", "production-full", "test"].includes(requested)
) {
  process.stderr.write("Unknown configuration mode.\n");
  process.exitCode = 2;
} else {
  const result = validateConfiguration(requested);
  process.stdout.write(
    `${JSON.stringify({
      mode: result.mode,
      valid: result.valid,
      configured: result.configured,
      errors: result.errors,
    })}\n`,
  );
  if (!result.valid) process.exitCode = 1;
}
