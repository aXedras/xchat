# Performance, Accessibility and UX Acceptance (Phase 15)

Status: accepted
Date: 2026-09-18

## Performance budgets

| Operation                 | Budget                        |
| ------------------------- | ----------------------------- |
| Initial chat load         | < 1.5s p95                    |
| Composer open             | < 300ms                       |
| Directory search          | < 250ms (debounced)           |
| Requester projection load | < 500ms (up to 50 recipients) |
| Recipient projection load | < 300ms                       |

## Query-plan approach (P15-002/P15-003)

- The requester projection aggregates invitations in a single `jsonb_agg` over
  `quote_request_invitations` (indexed by `request_id`); the response chain
  reads `quote_responses` by `invitation_id`.
- Indexes exist for the RFQ/response/deal/event access paths (Phase 4/7/8/10).
- Rule: only add an index when an `EXPLAIN` plan proves a bottleneck
  (bauplan 8.2 "kein vorsorglicher Vollindex"); pagination/debounce and
  list virtualization are applied only when a measurement requires them.

## Directory search (P15-005)

- `list_trading_participants` returns active participants; a debounced
  client-side filter (200ms) covers Release-1 directory sizes. Server-side
  pagination is added when a real measurement shows the need.

## Optimistic UI policy (P15-008/P15-009)

- Optimistic updates are used only for reversible, locally-confirmable UI state.
- `Send RFQ`, `Book Deal`, quote submission and document acknowledgement are
  never shown as final before the server confirms. `clientOperationId` reuse
  handles unknown results idempotently (no local "undo" after a server success).

## Accessibility checklist (P15-011..P15-013)

- Keyboard-only: all four composer tabs are focusable and navigable via the
  `Tabs`/`Select` primitives; buttons have visible focus.
- Screen reader: fields use `<Label>` association; the tab badge carries an
  error count (text), not color alone.
- Status is never color-only: status chips render text labels plus color;
  error counts are numeric badges.

## Responsive / i18n / timezone

- Mobile 320px, tablet, desktop are covered by the responsive composer layout;
  DE/FR text expansion is accommodated by wrapping labels.
- Deadlines are captured as local `datetime-local` and transmitted as UTC ISO
  timestamps; the server is authoritative for expiry.

## UX acceptance (P15-019)

Acceptance is performed by four representative roles (mine/producer,
refiner buy-side, refiner sell-side, trader). Findings are classified
Blocking/Major/Minor; Blocking and Major are closed before sign-off.
