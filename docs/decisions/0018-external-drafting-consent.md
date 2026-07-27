# ADR 0018: Exact external-provider consent

External transfer requires current owner consent bound to provider identity,
classification, consent version, and privacy-policy version. Revocation blocks
new calls; changes invalidate earlier consent; history remains append-only.
Local loopback providers need disclosure but not external-transfer consent.
