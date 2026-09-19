# ADR-004 — Booking and Confirmation Semantics

Status: Accepted
Date: 2026-09-18

## Context

The relationship between booking a deal and generating a trade confirmation
must be unambiguous: does the trade exist at `BOOK_DEAL`, or only once the
confirmation document is generated or acknowledged?

## Decision

Adopt the documented booking semantics (DEAL-SEM-001):

> Accepting a valid quotation via `BOOK_DEAL` conclusively books the trade in
> the system. The trade confirmation documents the already-booked trade. A
> later acknowledgement of the document is an evidence and control step, not a
> second precondition for the deal's existence.

Concretely:

- `trade_deals.status` becomes `booked` atomically at `BOOK_DEAL`.
- `confirmation_status` (`not_generated`, `generation_pending`, `generated`,
  `sent`, `acknowledged`, `failed`) is a separate field and never rolls back the
  deal.
- A document generation failure leaves the deal `booked`; the failure is
  visible and retryable (DEAL-006).
- `acknowledge_document` updates `confirmation_status` only (DOC-014).

## Consequences

- Positive: a single, testable source of truth for deal existence; document
  failures cannot corrupt a booked trade.
- Negative: if legal or operational semantics change, only the state machine
  (section 10.4) and Phase 12 release logic must change; the data model already
  keeps the two statuses separate.
