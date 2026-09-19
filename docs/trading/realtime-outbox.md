# Realtime, Outbox and Delivery Reliability (Phase 12)

Status: accepted
Date: 2026-09-18

## P12-001 — Persisted = accepted

- A mutation is committed only when its rows (aggregate + events + message +
  outbox) are persisted in the same transaction. Realtime is a best-effort
  notification, never a delivery proof.
- A failed realtime notification does not change the business commit. Clients
  that miss a notification reconcile via `list_trading_events_since`.

## Outbox

- `domain_outbox` rows are written in the same transaction as the business event.
  `event_id` + `recipient_user_id` is unique, so delivery is idempotent.
- The topic is always derived server-side (`user:{recipient_user_id}`); clients
  never supply a topic. `domain_outbox_topic()` is the single derivation point.
- The worker claims batches with `FOR UPDATE SKIP LOCKED` and marks rows
  `delivered` after a successful `realtime.send`; failures retry with backoff
  and dead-letter after a maximum attempt count.

## Catch-up

- `list_trading_events_since(since, limit)` returns the authenticated user's
  events (RFQ they own or were invited to, deals they are party to, documents
  they can view), ordered by time. Payloads are minimal IDs; details are loaded
  via the authorized projections.
