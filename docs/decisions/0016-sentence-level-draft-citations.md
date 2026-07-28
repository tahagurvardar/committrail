# ADR 0016: Sentence-level draft citations

Every candidate sentence must cite one or more selected evidence IDs. Citations
are normalized into relational rows with same-request and same-repository
foreign keys. Any unknown citation rejects the whole response; citations are
never silently removed or invented.
