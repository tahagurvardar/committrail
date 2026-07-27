# Drafting privacy boundary

A local loopback provider is classified `LOCAL`; selected facts leave the
CommitTrail web process for a configured service on the same machine. A non-loopback HTTPS
provider is `EXTERNAL`. Before an external generation, the current workspace
owner must consent to the exact provider identity, classification, consent
version, and privacy-policy version. Revocation blocks new calls without
rewriting historical generation records. A provider or policy identity change
requires new consent.

CommitTrail cannot promise how an external provider retains data. The consent
copy states only that selected normalized evidence and private intent may be
transmitted. The exact external payload contains:

- versioned CommitTrail instructions;
- the bounded untrusted drafting intent;
- one style enum;
- the explicitly selected normalized evidence bundle; and
- the required strict JSON output schema.

It excludes user name/email, workspace name, repository installation identity,
sessions, cookies, GitHub tokens, webhook data, raw GitHub bodies, raw README
content, unselected evidence, claims, audit events, provider secrets, and
account data. No separate repository full-name field is sent. The required
canonical evidence URL can still disclose repository identity, which is part
of the explicit external-transfer disclosure.

Logs contain only sanitized error codes and operational IDs. API keys, provider
authorization, prompt text, evidence text, intent, output, claim text, private
repository names, raw provider errors, and chain-of-thought are prohibited.
Export includes consent history and validated private drafting records, but no
secrets or transient provider material.
