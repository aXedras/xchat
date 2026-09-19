# xChat Trading Platform — Feature Flags

Status: draft (Phase 1)

## Flags (P1-013)

| Flag                     | Scope                                                         | Default (Release 1 rollout) |
| ------------------------ | ------------------------------------------------------------- | --------------------------- |
| `tradingOrganizationsV2` | Organizations, memberships, capabilities, roles, entitlements | off                         |
| `transactionRfqV2`       | Transaction-specific RFQ forms and dispatch                   | off                         |
| `quotationV2`            | Quotation, counter offers, pricing components                 | off                         |
| `dealV2`                 | Booking and deal snapshot                                     | off                         |
| `documentsV1`            | Document storage and Typst pipeline                           | off                         |
| `tradeVolumeV1`          | Trade volume ledger and CSV import                            | off                         |

## Server-authoritative configuration (P1-014)

- Flag state is authoritative on the server. The client only reads a projection it cannot mutate.
- The server exposes the effective flag set via a request-scoped read (e.g. part of `get_my_trading_context`
  or a dedicated `get_feature_flags`), filtered by organization where a flag is organization-scoped.
- Client-side feature-flag reading is read-only convenience for hiding UI; it never gates authorization.
  The server re-checks every entitlement and flag on each mutation regardless of what the client believed.
- No flag value originates from client payloads, localStorage, or unverifiable sources.

## Disabled-flag behavior (P1-015)

- The existing generic RFQ workflow remains fully functional while `transactionRfqV2` is off.
- No mixed payloads: a disabled flag means the corresponding V2 tables/RPCs/schemas are not exercised
  by new user actions; no record is written with a mix of V1 and V2 semantics.
- Flag transitions are atomic per request; a request is evaluated against one consistent flag snapshot.
- When `tradingOrganizationsV2` is off, the legacy `profile.organization` display path continues to work
  and the new directory is not used as an authority.

## Rollback rule (P1-016)

- Rolling back means disabling the flag. Data is never deleted and migrations are never reverted.
- Disabling a flag stops new V2 activity; already-written V2 data stays readable and unchanged
  (dual read lives only in the repository adapter, never in UI components).
- `quoted_premium` write paths are deprecated only in the final rollout phase; legacy read (version 0)
  remains available regardless of flag state.
- A rollback drill (P16-012) proves that V2 data remains readable and unchanged after flag deactivation.
