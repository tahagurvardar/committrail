# ADR 0014: Provider-neutral grounded drafting

Use a narrow server-only provider interface and native `fetch` for optional
OpenAI-compatible HTTP. Default to disabled, require no paid provider, and keep
fixtures dependency-injected and production-blocked. This prevents vendor
lock-in and keeps secrets, endpoints, and provider code out of client bundles.
