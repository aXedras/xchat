# Legacy Schema Migration (Phase 3 — P3-031 / P3-032)

Status: accepted
Date: 2026-09-18

## P3-031 — Migrating legacy `rawTerms` to the structured schema

The legacy RFQ terms are a flat, free-form object (see `normalize_rfq_terms` in
`supabase/migrations/20251003011000_function.sql`) plus a `rawTerms` text blob.
The target model is the structured four-tab schema (`commercial`, `material`,
`assay`, `logistics`) with `schema_version`.

Migration is non-lossy and additive:

- Existing `quote_requests` rows keep their original `terms` unchanged. No legacy
  record is rewritten in place.
- Rows that can be mapped are marked `schema_version = 0` and remain read-only
  for the legacy viewer; the original `rawTerms` text is never discarded.
- No automatic classification into a specific transaction type is attempted for
  legacy rows that lack one (a non-classifiable row stays version 0 and is
  reported rather than guessed).
- New RFQs always use a V2 schema (`schema_version = 1`); legacy and V2 payloads
  are never mixed in one record.
- Backfill runs as a separate, reviewable migration (Phase 4/P16 dry-run first),
  never silently during a V2 write.

## P3-032 — Legacy `quoted_premium` responses as schema version 0

Legacy `quote_responses` carry only `quoted_premium` (and optional `notes`).
They are treated as schema version 0:

- Readable forever through the legacy read path; never writable through the V2
  quotation schema.
- Not editable as V2 (a V2 edit would require a full structured quotation, which
  legacy responses do not carry).
- The schema registry (`getTradingSchema`) intentionally fails closed on
  version 0; legacy reads are handled at the repository/database boundary, not
  through the V2 schema registry.
- `quoted_premium` write paths are deprecated in the rollout phase (P16-019);
  the read path remains for version 0.
