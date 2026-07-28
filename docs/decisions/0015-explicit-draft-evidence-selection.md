# ADR 0015: Explicit evidence selection

The owner selects 1–12 stored facts from one authorized repository. The server
reloads canonical rows and never accepts evidence text from the browser. This
prevents a provider from selecting unrelated private data and creates a
deterministic, auditable input boundary.
