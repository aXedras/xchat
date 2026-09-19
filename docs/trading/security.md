# Security Model and Abuse Testing (Phase 13)

Status: accepted
Date: 2026-09-18

## Trust boundaries

- Browser/UI is untrusted. Every mutation is re-authorized server-side in a
  `SECURITY DEFINER` RPC that derives the actor's organization from their active
  membership and never trusts client-supplied organization IDs.
- The document-worker and outbox worker run under `service_role` only; the
  service-role key never reaches the browser.
- Supabase Storage is private; access is grant-checked and short-lived.

## STRIDE summary

| Threat                 | Mitigation                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- |
| Spoofing               | Supabase Auth JWT; `auth.uid()` checked first in every RPC                       |
| Tampering              | Append-only responses/decisions; immutable snapshots; server-side org derivation |
| Repudiation            | `quote_request_events`/`deal_events`/`document_events` audit trails              |
| Information disclosure | Separate requester/recipient projections; recipient isolation (SEC-003)          |
| Denial of service      | Length/range/array limits; idempotency locks; numeric(28,10) bounds              |
| Elevation of privilege | Entitlement checks (`has_entitlement`) + org-scope checks per mutation           |

## IDOR matrix

Every UUID-bearing RPC has a negative test using foreign and guessed IDs:

| RPC                                                | Foreign ID                          | Guessed ID         |
| -------------------------------------------------- | ----------------------------------- | ------------------ |
| `get_quote_request_projection`                     | not_authorized                      | not_authorized     |
| `get_quote_invitation_projection`                  | not_authorized                      | not_authorized     |
| `book_quote_response_v2`                           | not_authorized / response_not_found | response_not_found |
| `get_deal_projection`                              | not_authorized                      | deal_not_found     |
| `get_document_projection` / `acknowledge_document` | not_authorized                      | not_authorized     |
| `cancel_quote_request`                             | not_authorized                      | not_authorized     |
| `list_trade_volume` / `list_inventory_projection`  | org-scoped                          | org-scoped         |

## Dependency / static-analysis results

- `npm audit`: reduced 27 → 8 findings via non-breaking `npm audit fix`. Remaining:
  - `vite <=6.4.2` (high) — dev-only build tooling (EOL major); upgrade is a
    separate, breaking effort. Not shipped to the browser.
  - `react-router-dom <7` (moderate, transitive) — EOL major; breaking upgrade.
  - Remaining moderate transitive findings are dev/test tooling.
  - Accepted as documented debt; no runtime app dependency has an open high.
- `semgrep:owasp`: 0 findings (document-worker Dockerfile now runs as a non-root
  `USER`).
- `semgrep:arch` + `dependency-cruiser` + `jscpd`: green.

## Known residual items (risk-accepted for Release 1)

- Unicode control characters in free-text reference/labels are not yet
  normalized server-side (zod `max` limits apply; a dedicated normalization
  pass is tracked for a hardening follow-up).
- Rate limiting on directory/search and send/view endpoints is not yet wired
  (deployment-layer concern).
