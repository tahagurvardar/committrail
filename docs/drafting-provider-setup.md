# Drafting provider setup

No provider is required. With `DRAFT_PROVIDER=disabled` (the default), the
application builds normally and reports “Drafting provider not configured.”

Set `DRAFT_PROVIDER=openai-compatible` to use a server-side
OpenAI-compatible `/chat/completions` endpoint:

```text
DRAFT_PROVIDER=openai-compatible
DRAFT_PROVIDER_BASE_URL=http://127.0.0.1:11434/v1
DRAFT_PROVIDER_MODEL=your-local-model
DRAFT_PROVIDER_API_KEY=
DRAFT_PROVIDER_TIMEOUT_MS=30000
DRAFT_PROVIDER_MAX_INPUT_BYTES=65536
DRAFT_PROVIDER_MAX_OUTPUT_BYTES=16384
```

An API key is optional for loopback services. HTTP is accepted only for
loopback hosts; non-loopback providers require HTTPS. URLs containing
credentials, query strings, fragments, or unsupported schemes are rejected.
The endpoint is server-owned configuration and cannot be submitted by a user.
Redirects are not followed, requests and responses are size-bounded, timeouts
are strict, and there is no automatic HTTP retry loop, fallback provider,
hidden paid call, tool calling, or vendor SDK.

The deterministic fixture provider exists only for tests and explicit injected
development fixtures. Production runtime rejects it. CI does not contact a
model endpoint and uses no real API key.
