# Observability, Operations and Reconciliation (Phase 14)

Status: accepted
Date: 2026-09-18

## Correlation IDs

A `clientOperationId`/`correlationId` travels with every mutation:

- The client generates a `clientOperationId` (idempotency key) and reuses it on
  unknown results.
- RPCs write it to `quote_workflow_idempotency`, `message_dispatch`,
  `quote_request_events.correlation_id`, `deal_events.correlation_id` and
  `document_generation_jobs.correlation_id`.
- Repositories extract `correlationId` from business errors and log it
  (see `src/services/persistence/errors.ts`).

## Log fields and redaction

- Structured log fields: `correlationId`, `rpc`, `code`, `provider`, `jobId`.
- Commercial terms, pricing, PII and document contents are never logged
  (see the composer/dispatch logging paths). Redaction is enforced by only
  logging error codes and identifiers, never payloads.

## Health and readiness

- `public.health_check()` reports database health and basic object counts.
- Critical dependencies (database, storage) are required for readiness;
  optional providers (BIL, xComplianceFlow, document worker) are reported but
  do not block readiness (they surface as degraded).

## Reconciliation RPCs

| RPC                           | Checks                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `reconcile_rfq_status`        | RFQs whose status is inconsistent with an existing deal/award |
| `reconcile_deal_decision`     | booked deals without an accepted response decision            |
| `reconcile_trade_volume`      | booked deals without a volume entry (Phase 11)                |
| `reconcile_document_metadata` | generated documents without a version row                     |

All are read-only, `SECURITY DEFINER`, and return identifiers only.

## Alert thresholds and escalation

- `domain_outbox` pending/`dead_letter` backlog, `document_generation_jobs`
  stuck > 15 min, provider `unavailable`, and reconciliation non-empty results
  raise operational alerts. Escalation goes to the on-call operator.

## Runbooks

### Stuck RFQ dispatch

1. Query `message_dispatch` for `failed`/`partial` rows.
2. Re-run the same dispatch id (idempotent replay) after fixing the recipient.
3. Do not delete; idempotency prevents duplicates.

### Duplicate / mismatched idempotency

1. Inspect `quote_workflow_idempotency` for the actor + client id.
2. Compare `canonical_request` with the client payload; a mismatch is a client bug.

### Stuck document job

1. `document_generation_jobs` where status = `running` for > 15 min.
2. `claim_document_generation_job` (SKIP LOCKED) re-claims it; failed jobs
   retry automatically and dead-letter after max attempts.

### Provider unavailable

1. `health()` of the mock/BIL/compliance provider.
2. UI surfaces `unavailable` (never `approved`); policy-pflichtige Aktionen
   werden gemäß Matrix blockiert.

### Suspected data leakage

1. Query `document_events`, `quote_request_events`, `deal_events` audit trails.
2. Verify grants/topics are user-scoped; escalate to the security on-call.
