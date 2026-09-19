# Role Transition Matrix (Phase 2 — P2-016)

Status: accepted
Date: 2026-09-18

The legacy `public.user_roles` values (`app_role` enum) are mapped to the new
platform roles as follows during the transition. The legacy table remains
readable for existing consumers and is not dropped in Phase 2.

| Legacy role | New platform role | Scope                                     | Notes                                                   |
| ----------- | ----------------- | ----------------------------------------- | ------------------------------------------------------- |
| `vendor`    | `PLATFORM_ADMIN`  | platform-wide (`organization_id IS NULL`) | Retains Admin Console access; seeded on the admin user. |
| `manager`   | `ORG_ADMIN`       | organization-scoped                       | Organization administrator of their active membership.  |
| `operator`  | `OPERATIONS`      | organization-scoped                       | Operations/inventory/trade-volume responsibilities.     |

Mapping notes:

- The legacy roles are a single role per user (`user_roles.user_id` is unique),
  whereas the new model allows multiple organization-scoped roles per user.
- The transition keeps `user_roles` intact for backward compatibility; new
  authorization checks use `has_entitlement()` / `user_platform_roles`.
- Existing seed users are assigned new memberships and roles directly in
  `supabase/seed.sql` (see P2-017/P2-018); no production backfill is performed
  in Phase 2.
- `manager` and `operator` have no seeded representatives yet; the mapping is
  documented here for when legacy users are migrated in the rollout phase (P16).
