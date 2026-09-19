# Release Notes — xChat Trading Platform (Release 1)

Status: draft
Date: 2026-09-18

## Scope

Organization-based trading platform on top of the existing xChat chat:

- Normalized organizations, memberships, capabilities, roles and entitlements.
- Seven transaction macros with four-tab RFQ and quotation forms.
- Multi-recipient fan-out with strict recipient isolation.
- Append-only quotations with typed pricing components and counter offers.
- Atomic, idempotent `BOOK_DEAL` with an immutable trade snapshot.
- Compliance and inventory provider ports with deterministic mocks.
- Document storage with access grants and a Typst render worker.
- Trade volume ledger with staged CSV import.
- Outbox-based reliable delivery and catch-up reconciliation.

## Known limitations

- Split awards and partial-quantity awards are out of scope (single award).
- No live market-data / price-ticker integration (OUT-MD-001).
- BIL and xComplianceFlow are mock adapters; no productive connection.
- No electronic signature / QES; no settlement/payment/shipment tracking.
- Rate limiting and Unicode control-character normalization are deployment
  follow-ups (see docs/trading/security.md).
- `vite` and `react-router` are EOL majors (dev/build tooling debt).
- Document tags are written by the document worker; the tag-writing step is an
  open item for the worker (see docs/trading/rollout.md).

## Operator checklist

1. `npm run supabase:reset` (local) or `npm run supabase:push` (deploy) applies
   all timestamped migrations.
2. `npm run ci:verify` (lint + build + unit + schema drift + OpenAPI lint +
   jscpd + depcruise + semgrep:arch).
3. `npm run supabase:test` (pgTAP) and `npm run test:e2e` (Playwright).
4. Feature flags are off by default in production (feature_flags table); enable
   per organization during rollout (docs/trading/rollout.md).
5. Runbooks: docs/trading/operations.md.
