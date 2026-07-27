# ADR 0011 — Do not store webhook payloads

After verification, CommitTrail extracts only the IDs, action, ref, and
identity hints required to route reconciliation. The body, headers,
signature, commit arrays/messages/emails, issue and release text, cookies,
and authorization are discarded. Delivery rows retain only a digest, byte
count, sanitized state, and resolved relations.
