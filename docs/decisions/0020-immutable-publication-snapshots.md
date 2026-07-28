# ADR 0020: Immutable publication snapshots

Public pages render only a current immutable `ProjectPublicationRevision`, never mutable live claims. Draft edits have no public effect until an explicit replacement revision is published. This makes preview/public consistency, audit history, and rollback-safe transactions inspectable.
