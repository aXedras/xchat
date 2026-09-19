# Migration, Rollout and Legacy Shutdown (Phase 16)

Status: accepted
Date: 2026-09-18

## Legacy data migration

1. **Backfill dry run**: run the backfill statements against an anonymized copy
   and record counts before/after (`requester_organization_id`,
   `recipient_organization_id`, `responder_organization_id`, deal references).
2. **Non-classifiable rows**: any legacy RFQ/response without a resolvable
   organization stays schema version 0 and is reported, never guessed.
3. **Read-only legacy**: legacy rows remain readable through the repository
   adapter (version 0); they are never written as V2.

## Feature-flag rollout

1. Start with the internal test organization only (`tradingOrganizationsV2`,
   `transactionRfqV2`, `quotationV2`, `dealV2`).
2. Smoke tests, then a security-isolation re-test with separate accounts.
3. Enable for pilot organizations; observe metrics/errors.
4. Rollback drill: disable the flag. V2 data stays readable and unchanged
   (dual read lives only in the repository adapter, never in UI components).

## Legacy RFQ shutdown

1. The legacy `/rfq` composer opens only for legacy drafts.
2. After the transition period, new legacy RFQ creation is disabled
   (`transactionRfqV2` on).
3. `quoted_premium` write paths are removed; read remains for version 0.

## Final release

- README and architecture docs updated to the shipped state.
- OpenAPI, schema registry and Typst template versions documented.
- Final requirements traceability report generated.
- Full quality-gate suite green.
