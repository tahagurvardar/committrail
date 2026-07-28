# Authorization matrix

| Surface                                     | Anonymous                               | Authenticated non-owner | Workspace owner           |
| ------------------------------------------- | --------------------------------------- | ----------------------- | ------------------------- |
| Landing, about, methodology, synthetic demo | Read                                    | Read                    | Read                      |
| Public explorer and repository snapshot     | Read public GitHub facts                | Same                    | Same                      |
| PUBLIC profile/project revision             | Read immutable disclosed snapshot       | Same                    | Same                      |
| UNLISTED project revision                   | Read only with exact URL; `noindex`     | Same                    | Same                      |
| Draft/unpublished/private publication       | Generic not found                       | Generic not found       | Manage                    |
| Dashboard, evidence, claims, drafts         | Redirect/login                          | Denied/not found        | Read/write                |
| GitHub installations and sync               | Denied                                  | Denied                  | Manage owned installation |
| Private portfolio outputs/download          | Denied                                  | Denied                  | Read/build/download       |
| Account export/deletion                     | Denied                                  | Denied                  | Own account only          |
| Webhook intake                              | Valid HMAC and known installation event | Same                    | Same                      |
| Health liveness/readiness                   | Sanitized read                          | Same                    | Same                      |

All owner-scoped service queries include workspace or user ownership in the
database predicate; actions do not trust a client-supplied owner identifier.
Missing and unauthorized private resources intentionally share generic
responses to reduce enumeration. Publication snapshots disclose only the
explicitly reviewed evidence projection; private repository source URLs and
identifiers are redacted. Browser tests cover cross-boundary anonymous access,
private downloads, unpublished routes, and public/unlisted metadata.
