# ADR 0006 — Verified GitHub App installation

Activate only after app-authenticated installation lookup and a separate
user OAuth flow with new state and PKCE confirms access to the pending
installation. Setup query parameters and state alone are not ownership proof.
