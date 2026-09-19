# ADR-002 — RFQ JSON Schema and Typed Columns

Status: Accepted
Date: 2026-09-18

## Context

The existing RFQ stores generic free-form terms and a single `quoted_premium`.
The target system needs deterministic, versioned, transaction-specific forms
for seven macros, with structured request and quotation payloads that share one
canonical shape but differ semantically.

## Decision

Model the RFQ terms as a canonical JSON root with four tabs
(`commercial`, `material`, `assay`, `logistics`), stored in a `terms jsonb`
column alongside typed columns for the fields that drive queries and state
(`transaction_type`, `schema_version`, `response_deadline`, `status`).

- Versioned JSON Schemas (JSON Schema + mirrored Zod schemas) are the single
  source of field semantics; unknown keys are rejected fail-closed.
- Decimal, currency, unit, country and timestamp scalars are defined once and
  reused across schemas.
- Server-side SQL validation mirrors the TypeScript/Zod validation from the same
  field IDs, verified by contract tests.
- Payloads are canonicalized (trim, decimal normalization, key ordering, empty
  optional removal) and hashed for idempotency.
- Legacy records without a structured schema are schema version 0 and remain
  readable; they are never writable as V2.

## Consequences

- Positive: deterministic validation, schema evolution without breaking reads,
  a single contract between client and server.
- Negative: cross-field rules not expressible in JSON Schema must be documented
  and enforced in Zod + SQL explicitly; migration of legacy `rawTerms` requires
  a non-lossy backfill (P3-031).
