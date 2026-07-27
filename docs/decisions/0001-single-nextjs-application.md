# ADR 0001 — Single Next.js application

- **Status:** Accepted
- **Date:** 2026-07-27
- **Phase:** 0

## Context

CommitTrail needs a public marketing surface, an authenticated product
surface (later), API endpoints for ingestion (later), and background
processing (later). The classic split — separate SPA + Express/NestJS
backend — doubles deployment surface, type duplication, and auth plumbing
before the product has proven its shape.

## Decision

Build CommitTrail as **one Next.js 16 App Router application** (`src/`
layout, strict TypeScript, Server Components by default). Route handlers
will host webhook/API endpoints when they arrive; background work will run
as queue-driven jobs beside the same codebase rather than a separate
service.

No separate Express, NestJS, or other backend framework.

## Consequences

- One deployable, one type system, shared domain code between UI and future
  API surface.
- Server Components keep data access on the server by default, which suits
  a read-only, evidence-rendering product.
- Long-running sync jobs cannot live inside request handlers; the phase
  that introduces continuous ingestion (Phase 3 in the roadmap) must add an
  explicit job runner (reserved in the architecture doc) rather than abusing
  serverless request lifetimes.
- If ingestion load ever outgrows the app, extraction of a worker service is
  possible because ingestion code is kept behind interfaces from the start.

## Alternatives considered

- **Next.js frontend + NestJS backend:** rejected — premature service split,
  duplicated auth and types, slower iteration in the phase where product
  shape matters most.
- **Static site + serverless functions:** rejected — the future product is
  data- and review-heavy; a framework with first-class server rendering and
  route handlers fits better.
