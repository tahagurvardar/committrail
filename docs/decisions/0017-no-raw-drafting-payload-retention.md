# ADR 0017: Do not retain raw prompts or provider responses

Retain only the bounded intent, deterministic bundle metadata, validated
candidate, normalized citations, caveats, coverage, and safe usage metadata.
Never retain request headers, API keys, hidden prompts, raw responses, raw
provider errors, or chain-of-thought. This makes privacy behavior independent
of provider response shape.
