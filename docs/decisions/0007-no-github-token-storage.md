# ADR 0007 — No GitHub token storage

App JWTs, OAuth user tokens, and installation tokens exist only for one
bounded server operation. They are never stored, logged, exported, cached,
or sent to the browser.
