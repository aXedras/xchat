# AGENTS.md — xChat

Professional chat platform for the precious metals industry. React 18 + TypeScript + Vite + shadcn/ui on the frontend, Supabase for auth, persistence and realtime.

This file is project-specific. General working rules (SOLID/KISS/YAGNI/DRY, commit approval, no `--no-verify`, no root-cause-masking fallbacks, error handling via `logger`) are defined globally and take precedence where they overlap.

## Orientation

`graphify-out/graph.json` is a knowledge graph of this codebase. For "where should I look / what is connected / what could be affected" questions, use graphify first:

- `graphify query "<focused question>"` — broad discovery.
- `graphify explain "<symbol>"` — once a symbol is known.
- `graphify path "<A>" "<B>"` — relationship between two known concepts.

Source code remains the source of truth. After graphify narrows the search, verify with targeted reads. Rebuild the graph after code changes with `graphify update .`.

## Architecture

Dependency direction is one-way: outer layers (pages/components) depend on hooks, which depend on repositories, which depend on Supabase. Domain/persistence code must not import UI.

```
src/pages/          # page components (Dashboard, Index, Profile, Admin, NotFound)
src/components/     # UI; ui/ = shadcn primitives, chat/, admin/, profile/
src/hooks/          # state hooks (useChatState, useActiveChats, useChatLists, ...)
src/services/       # services + realtime/auth/admin
src/services/persistence/   # repositories (messageRepository, chatConversationRepository)
src/config/         # environment config
src/types/          # shared TypeScript types (chat.ts is the messaging domain hub)
src/i18n/           # en.json / de.json / fr.json
src/lib, src/utils  # cn() helper, formatters, pure utilities
```

## Database access (non-negotiable)

- UI code never calls Supabase directly. All reads/writes go through repositories in `src/services/persistence/`, which wrap Supabase RPCs.
- `conversations`, `messages` and the RFQ aggregate tables (`quote_requests`, `quote_request_invitations`, `quote_responses`, `quote_response_decisions`, `trade_deals`, `quote_workflow_idempotency`) have RLS enabled but no direct client grants. Access is exclusively via `SECURITY DEFINER` RPCs.
- Server errors use `public.raise_business_error(code, details)` (`ERRCODE P0001`, `DETAIL` JSON). The frontend maps them via `toMessagingError` to `MessagingError.code`.

## Supabase schema & migrations

- xChat uses **timestamped migration files** in `supabase/migrations/` (e.g. `20260916010000_delete_conversation.sql`). Each new schema change gets its own new numbered migration file. Do NOT edit an existing, already-applied migration.
- New RPCs must be `SECURITY DEFINER` with `SET search_path = ''`, fully schema-qualified, and end with `GRANT EXECUTE ... TO authenticated` plus `REVOKE EXECUTE ... FROM PUBLIC, anon`.
- Add any index a new query depends on in the same migration (`CREATE INDEX IF NOT EXISTS`).
- Destructive logic (e.g. `delete_conversation`) is one PL/pgSQL transaction per RPC; lock the target row (`SELECT ... FOR UPDATE`) and surface business errors, never raw FK errors.
- `supabase db reset` rebuilds the local DB from migrations + `supabase/seed.sql` — safe to run any time in dev.

## Tests

- pgTAP DB tests live in `supabase/tests/closed_group_messaging.sql` (single file; update `SELECT plan(N);` whenever assertions change).
- Playwright e2e specs live in `e2e/`. Login helpers authenticate via Supabase-seeded users from `supabase/seed.sql` (`alice@xchat.test.local` etc.).
- Seed data is in `supabase/seed.sql` (demo users + the vendor-admin user with `user_roles.role = 'vendor'`).

## i18n

Every new user-facing key must be added to `en.json`, `de.json` and `fr.json` with identical structure. i18next namespaces (`chat.*`, `errors.*`, ...) are distinct — do not confuse similarly-named keys across namespaces.

## Quality gates

```
npm run build            # type-check + production build
npm run lint             # eslint
npm run jscpd            # duplicate-code check
npm run depcruise        # dependency-direction rules
npm run semgrep:arch     # architecture rules
npm run ci:verify        # lint + build + jscpd + semgrep:arch
npm run supabase:reset   # rebuild local DB (migrations + seed)
npm run supabase:test    # pgTAP tests
npm run test:e2e         # Playwright (needs a running Supabase + dev server)
```

Run the relevant gates before considering a change complete. Never bypass a failing gate.
