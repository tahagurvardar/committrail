# Publication lifecycle

1. Configure a minimal profile.
2. Save a private project draft with plain-text narrative.
3. Select eligible verified claims and order them.
4. Choose an explicit disclosure for evidence.
5. Inspect the exact authenticated public preview.
6. Type `PUBLISH` and acknowledge public and, when applicable, private-source disclosure.
7. Commit one immutable snapshot transaction and invalidate only its profile/project cache keys.
8. Edit the private draft without changing the public revision.
9. Publish a replacement revision, unpublish, republish, archive, or restore explicitly.

Health is mechanical:

- `CURRENT`: source claim statements and evidence hashes still match.
- `REVIEW_REQUIRED`: a source claim or evidence hash changed after publication.
- `SOURCE_UNAVAILABLE`: the repository/evidence is inaccessible or removed.

Health is not a truth score. Public text is never silently rewritten. REVIEW_REQUIRED adds a restrained review notice. Private-source loss, repository disconnect, installation removal, profile hiding, or account deletion removes public access and invalidates profile/project/sitemap caches. Retired slugs remain reserved without retaining a public personal snapshot.

Public immutable snapshots contain author-approved fields, claim snapshots, disclosure snapshots, timestamps, visibility, and a canonical content hash. Internal source IDs remain private provenance and are excluded from public view objects.
