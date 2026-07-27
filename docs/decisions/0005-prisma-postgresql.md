# ADR 0005 — Prisma ORM 7 and PostgreSQL 17

Use Prisma ORM 7.9.1, `@prisma/adapter-pg`, and committed PostgreSQL
migrations. Client creation is lazy. Test database preparation fails closed
against non-test or development-equal URLs.
