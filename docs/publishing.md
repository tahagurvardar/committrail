# Deliberate publishing

Phase 5 turns reviewed private claims into public portfolio material only after an explicit owner ceremony. A private draft selects one tracked repository, one public profile, eligible verified claims, and an explicit disclosure mode for every disclosed evidence record.

Publication is never triggered by sync, webhook ingestion, claim verification, drafting, or output building. The server locks the draft, checks its optimistic version, rechecks profile visibility, slug permanence, claim eligibility, evidence accessibility and hashes, validates the public privacy policy, and requires `PUBLISH` plus disclosure acknowledgements.

PUBLIC projects may be indexed and appear on the public profile and sitemap. UNLISTED projects are accessible to anyone with the URL but use `noindex, follow` and never appear in profile indexes or the sitemap. UNLISTED is not authentication.

Publishing creates an immutable revision. Editing changes only private draft fields. A replacement publication creates another revision; older content, timestamps, hashes, claims, and disclosures remain unchanged. Unpublishing immediately makes the route return a generic 404 while preserving private history. Archiving is private organization and prevents republishing until restoration.

Public rendering reads only the current immutable revision. It never joins mutable claims to compose public text. Preview uses the same public view model and renderer, is authenticated, dynamic, private/no-store, and not indexed.

No model provider is called during publishing, preview, export, or deterministic output building. Phase 5 adds no deployment, billing, teams, email, analytics, scoring, or GitHub writes.
