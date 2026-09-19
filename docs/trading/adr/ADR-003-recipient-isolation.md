# ADR-003 — Recipient Isolation

Status: Accepted
Date: 2026-09-18

## Context

An RFQ may be sent to multiple recipients. The sender sees per-recipient
delivery, view and response status, but a recipient must never learn the
identity, count or status of other recipients, nor their responses, prices or
documents. This isolation is a no-tolerance security requirement, not a UI
convenience.

## Decision

Enforce recipient isolation structurally, not by hiding UI:

- Requester and recipient use separate projections with separate TypeScript
  types and separate SQL builders (SEC-018). A shared DTO with hidden optional
  fields is prohibited.
- A recipient reads an invitation only via their own `invitation_id` and
  `recipient_user_id = auth.uid()`; response queries start from the authorized
  invitation, never from the request.
- No recipient endpoint returns `request_id -> invitations[]`. Counts, winner,
  response count and recipient status appear only in the requester projection.
- Realtime topics remain `user:{auth.uid}`; there are no RFQ-wide recipient topics.
- Errors are side-channel neutral: they never reveal the existence of sibling
  invitations.
- On award, losing recipients receive only a neutral `RFQ_CLOSED` event.
- Negative tests use at least three organizations and systematically attempt
  IDOR access (SEC-013).

## Consequences

- Positive: isolation is enforced at the data/authorization boundary, making
  leakage detectable and testable rather than assumed.
- Negative: dual projections and dual SQL builders are more code to maintain;
  this is an accepted cost of the security guarantee.
