import { getAppMode } from "@/lib/config/app-mode";
import {
  validateConfiguration,
  type ConfigurationMode,
} from "@/lib/config/validation";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const mode: ConfigurationMode =
    process.env.E2E_FIXTURES === "1"
      ? "test"
      : getAppMode() === "public-demo"
        ? "public-demo"
        : process.env.NODE_ENV === "production"
          ? "production-full"
          : "local-full";
  const result = validateConfiguration(mode);

  if (!result.valid) {
    throw new Error(`CONFIGURATION_INVALID: ${result.errors.join(" ")}`);
  }
}
