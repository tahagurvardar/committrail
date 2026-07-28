# Public profile

Each personal workspace may own one minimal public profile at `/profiles/[profileSlug]`.

Public fields are user-authored plain text: display name, headline, biography, optional location, optional personal website, and optional GitHub profile URL. Email, user/workspace IDs, installation identity, and repository identity are never inferred or published automatically. URLs must be HTTPS, have no credentials/query/fragment, and must not target local or private networks.

Profile slugs use 3–40 lowercase ASCII letters, numbers, and single hyphens. Reserved routes are rejected. PostgreSQL enforces case-insensitive uniqueness and the permanent reservation table prevents takeover. The slug is editable only before first publication.

Setting visibility to PRIVATE immediately hides the profile and all associated public project routes, including direct UNLISTED links. Project statuses and immutable history remain private in the dashboard so the owner can restore the profile deliberately.
