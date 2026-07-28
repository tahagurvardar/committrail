# Grounded drafting

Phase 4 adds private claim suggestions derived only from evidence the workspace
owner explicitly selects. Drafting is disabled by default and requires no paid
API. A loopback OpenAI-compatible service may be used locally; an HTTPS
OpenAI-compatible service is optional and requires provider-specific external
transfer consent.

## Data flow

1. The owner selects 1–12 currently available facts from one tracked
   repository and supplies a 1–500 character plain-text intent plus a
   `concise`, `technical`, or `interview` style.
2. The server reloads canonical evidence from PostgreSQL, whitelists normalized
   factual fields, deterministically orders it, and records content hashes,
   bundle schema version, and byte size.
3. A PostgreSQL job is leased by the existing worker. Evidence hashes and
   external consent are checked before any provider call.
4. The server sends versioned policy instructions, the untrusted intent, the
   selected evidence JSON, and the required output schema. It sends no account,
   session, installation, webhook, raw GitHub, unselected evidence, or provider
   secret data.
5. The response must be strict JSON with 1–4 plain-text sentences. Every
   sentence must cite one or more selected evidence IDs. An unknown citation,
   unsafe markup, policy violation, stale evidence, or size violation rejects
   the entire response.
6. Only the validated candidate, normalized sentences/citations, caveats,
   mechanical coverage, and safe usage metadata are retained. Raw requests,
   raw responses, hidden prompts, provider errors, and chain-of-thought are not
   stored or displayed.

`VALID` grounding means the structural citation and evidence-version checks
passed. It is not a truth score or factual guarantee. A later evidence change
marks the historical candidate `STALE` and blocks new acceptance.

## Queue and limits

Equivalent active submissions are idempotent. One active generation is allowed
per workspace/repository/user, with five submissions per user per rolling ten
minutes and twenty per workspace per rolling day. Provider timeout, 429, 5xx,
and temporary connection failures use the existing bounded worker backoff.
Invalid output, missing consent, changed evidence, and policy violations are
permanent. Provider calls never occur inside database transactions.

Candidates are immutable suggestions. Rejection is append-only review history;
regeneration creates a separate request. Acceptance creates or replaces a
private claim with `AI_ASSISTED` origin, linked evidence, and `DRAFT` state.
Only a later explicit owner action can verify the claim.

# Publishing AI-assisted claims

An accepted AI-assisted claim cannot publish until the owner explicitly
verifies it. Public snapshots retain the AI_ASSISTED origin and display:
"AI-assisted wording, reviewed and verified by the author." Provider identity,
prompts, candidates, and usage are never public.
