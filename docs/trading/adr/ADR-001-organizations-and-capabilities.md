# ADR-001 — Organizations and Capabilities

Status: Accepted
Date: 2026-09-18

## Context

Today a user's company is a free-text `profile.organization` and roles are
`vendor`/`manager`/`operator`. The trading platform requires a normalized,
server-authoritative model in which every user belongs to exactly one active
organization, organizations have business capabilities, and personal
permissions are separated from organization type.

## Decision

Introduce a normalized organization model:

- `organizations` — legal identity (`legal_name`, `display_name`,
  `registration_number`, `lei`, `jurisdiction_country_code`, `status`,
  `source_system`, `external_reference`).
- `organization_capabilities` — time-boxed market roles
  (`REFINER`, `MINE_OPERATOR`, ...) with a partial unique index for at most one
  active capability per `(organization_id, capability_code)`.
- `organization_units` — departments/desks/sites with a self-FK and a
  constraint trigger rejecting cross-organization parents.
- `organization_memberships` — historical membership periods with a partial
  unique index enforcing at most one active membership per user.
- `platform_roles`, `platform_entitlements`, `platform_role_entitlements`,
  `user_platform_roles` — organization-scoped roles and entitlements.

Authorization derives from: active membership, active organization capability,
personal entitlement, and active user/organization status. The server decides
permission; the client only hides unavailable options.

RFQ/Deal rows store organization snapshots so later employment changes do not
reinterpret history.

## Consequences

- Positive: clean separation of organization, capability and permission;
  historical fidelity; server-authoritative directory.
- Negative: legacy free-text `profile.organization` must be migrated/backfilled
  and a transition matrix for old `user_roles` documented (P2-016/P2-017).
- The old free-text field is kept readable during rollout and only deprecated later.
