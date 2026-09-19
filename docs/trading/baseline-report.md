# Phase 0 — Baseline Report

Status: completed
Date: 2026-09-18
Branch: feat/rfq-trading-platform

## Environment

| Item                  | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Branch                | feat/rfq-trading-platform (from main)                             |
| Base commit           | 01febc7 Merge pull request #3 (feat/delete-chat-and-login-polish) |
| Node                  | v22.22.2                                                          |
| npm                   | 10.9.7                                                            |
| Supabase CLI (global) | 2.104.0                                                           |
| Supabase CLI (npx)    | 2.117.0                                                           |

## Config file presence (P0-008)

All present at expected paths:

- .dependency-cruiser.cjs
- .jscpd.json
- .semgrep/architecture.yml
- .env.example
- package-lock.json
- scripts/run-semgrep.sh

## Lockfile & package manager (P0-006, P0-007)

- package.json and package-lock.json are in sync; `npm ci --dry-run` succeeds without lockfile change.
- bun.lockb is present but treated as legacy (Altbestand); not used.

## .env.example (P0-009)

Contains only placeholders (no production secrets).

## Security debt (P0-010)

- `VITE_BIL_API_KEY` is read client-side in src/config/environment.ts and declared in .env.example.
  BIL credentials belong in server-side secrets; this is recorded as debt, not migrated in Phase 0.

## xTrace cleanup (P0-011, P0-012)

`rg -i xtrace` yields only:

1. supabase/migrations/20260918000000_remove_xtrace_legacy_schema.sql — the cleanup migration itself (legitimate).
2. docs/xChat_RFQ_Trading_Platform_Implementierungsbauplan.md — documentation references.

No trading source code references xTrace.

## README migration references (P0-013)

README.md references two migrations that do not exist:

- supabase/migrations/20260320010000_xchat_realtime_persistence.sql
- supabase/migrations/20260320011000_xchat_security_hardening.sql

Actual migrations present in supabase/migrations/:

- 20251003010000_tables.sql
- 20251003011000_function.sql
- 20251003012000_trigger.sql
- 20251016030000_Index.sql
- 20251017000000_RLS.sql
- 20251023093631_grants.sql
- 20260916000000_profile_avatar.sql
- 20260916010000_delete_conversation.sql
- 20260916020000_fix_admin_create_user_profile.sql
- 20260918000000_remove_xtrace_legacy_schema.sql

The README is stale and is not the source of truth (consistent with bauplan 2.1 #17).

## Quality gates (P0-014 .. P0-019)

| Gate                   | Result                                                |
| ---------------------- | ----------------------------------------------------- |
| npm run lint           | PASS (exit 0)                                         |
| npm run build          | PASS (exit 0; chunk-size warning only)                |
| npm run jscpd          | PASS (exit 0; 6 pre-existing clones within tolerance) |
| npm run depcruise      | PASS (0 violations)                                   |
| npm run semgrep:arch   | PASS (0 findings)                                     |
| npm run supabase:reset | PASS (10 migrations + seed applied)                   |
| npm run supabase:test  | PASS (152 tests)                                      |
| npm run test:e2e       | PASS (29 tests)                                       |

## Known debt items

1. VITE_BIL_API_KEY exposes a BIL secret surface client-side (P0-010).
2. bun.lockb legacy lockfile still present (P0-007).
3. README.md references non-existent migrations (P0-013).
4. jscpd reports 6 duplicate-code clones (within configured tolerance, pre-existing).
5. Vite build warns about a chunk larger than 500 kB (no functional impact).

## Untouched user changes

Worktree was clean at Phase 0 start apart from the untracked implementation plan
(docs/xChat_RFQ_Trading_Platform_Implementierungsbauplan.md). No user changes were modified.

## Gate P0

PASS — all baseline gates green; no pre-existing failing gate requiring separate acceptance.
