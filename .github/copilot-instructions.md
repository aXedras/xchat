# GitHub Copilot Instructions for complianceFlow

## 🚨 CRITICAL RULES - READ FIRST 🚨


## Quick orientation for AI coding agents

This file contains focused, discoverable knowledge to help an AI agent be productive in the Anlageheld repo.

### behavioral rules

- do NOT take assumptions. Ask
- do ASK for requirements.
- do NOT just start generating code. Yes you are good in that, but it is useless
- always prepare a step-by-step plan before coding. we call this "bauplan".
- run pre commit hooks, always, without asking
- you forget that there is a -no-verify option for committing. This does not exist.
- follow senior software engineering principles (SOLID, KISS, YAGNI, DRY))
- do not add fallbacks and defaults to the code, this hides the root cause of errors and makes debugging harder. Always handle errors explicitly and log them with context using the logger utility.
- we try to commit often, but only when all test are passing. You always ask for user approval, you never commit on your own decision. Never.
- we try to organize work into small, incremental and independent bundles.

## Critical Rules (Non-Negotiable)

❌ **Never do this:**

- Files > 300 lines
- Unhandled promise rejections
- ESLint errors
- Code duplication
- Fallbacks that hide root errors
- Create README files outside approved locations
- Features that aren't currently needed (YAGNI)
- Complex solutions when simple ones work (KISS)
- Commit on your own decision
- Drop/reset the database on your own decision
- Commit temporary files (.backup, .old files)
- **Make changes before understanding the root cause**
- **NEVER COMMIT OR PUSH WHEN TESTS ARE FAILING** (This is critical and non-negotiable!)
- **NEVER make direct database calls - ALWAYS use repositories** (See Repository Pattern section below)

✅ **Always do this:**

- Extract shared code
- Handle all errors explicitly
- Log errors with context using logger utility
- Use TypeScript strictly
- Follow existing patterns
- Keep it simple (KISS)
- Build only what's needed now (YAGNI)
- **Ask if you are unsure**
- **Run all relevant tests BEFORE committing** (unit tests minimum, integration tests when touching batch/import logic)
- **Fix ALL failing tests before any commit** - zero tolerance for broken tests
- **Wait for explicit user approval before committing**


### **NEVER CREATE NEW DATABASE MIGRATIONS**

**This project is in DEVELOPMENT PHASE. We are NOT live yet.**

❌ **DO NOT** create new migration files in `supabase/migrations/`
❌ **DO NOT** add new numbered migration files like `20251212000000_*.sql`
❌ **DO NOT** use ALTER TABLE statements in new migrations

✅ **DO** modify existing CREATE TABLE statements directly in:

- `supabase/migrations/20251117120005_tables_core.sql`
- `supabase/migrations/20251117120004_tables_reference.sql`
- `supabase/migrations/20251117120006_tables_application.sql`

✅ **DO** add indexes to:

- `supabase/migrations/20251117120013_indexes.sql`

✅ **DO** add functions to:

- `supabase/migrations/20251117120007_functions.sql`

✅ **DO** add triggers to:

- `supabase/migrations/20251117120008_triggers.sql`

✅ **DO** add RLS policies to:

- `supabase/migrations/20251117120009_rls_policies.sql`

✅ **DO** run `supabase db reset` after changes - we can always reset!

### Why This Rule Exists

Creating new migrations causes:

- Migration sprawl (100+ files)
- Difficult maintenance
- Hours of cleanup work
- Redundant ALTER TABLE statements
- Unnecessary complexity

Since we're not live, we can freely modify the base schema and reset the database.

## Database Schema Management

### Adding a Column to an Existing Table

**WRONG:**

```sql
-- ❌ DO NOT create a new migration file
-- supabase/migrations/20251212000000_add_column.sql
ALTER TABLE public.individuals ADD COLUMN middle_name text;
```

**CORRECT:**

```sql
-- ✅ Edit the existing CREATE TABLE in 20251117120005_tables_core.sql
CREATE TABLE public.individuals (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name text NOT NULL,
    middle_name text,  -- Add the column here directly
    last_name text NOT NULL,
    -- ... rest of columns
);
```

### Adding a New Table

**Add new tables to the appropriate existing migration:**

- Core business entities → `20251117120005_tables_core.sql`
- Reference data → `20251117120004_tables_reference.sql`
- Application-specific → `20251117120006_tables_application.sql`

### Adding Indexes

Add to `20251117120013_indexes.sql` in the appropriate section.

### Adding Functions

Add to `20251117120007_functions.sql`.

### Adding Triggers

Add to `20251117120008_triggers.sql`.

### Adding RLS Policies

Add to `20251117120009_rls_policies.sql`.

## Testing After Changes

Always run after modifying schema:

```bash
supabase db reset
bun run build
bun run test
```

## Pre-commit Hook

A pre-commit hook prevents creating new migration files. See `.husky/pre-commit`.

## PEP Domain Architecture

### Critical Intent

- `public.ftm_pep_reference` is the global external reference corpus for FTM PEP data.
- `public.pep` is NOT a normalized copy of all external PEPs.
- `public.pep` is reserved for PEP information that originates from onboarding flows and applicant-related declarations.

### What Goes Where

- Use `ftm_pep_reference` for global PEP search, screening, filtering, and operator views over the external world-wide reference set.
- Use `pep` only for applicant/customer-context PEP records discovered or declared during onboarding.
- `individuals` and `corporates` are operational entities created and maintained by onboarding workflows, not by bulk-importing all external reference people.

### Do Not Assume Normalization Into `pep`

❌ Do not bulk-import or normalize the full FTM corpus into `pep` unless the user explicitly requests a new architecture.

❌ Do not treat `pep` as the main read model for the external PEP corpus.

✅ Assume the current intended split is:

- external reference corpus -> `ftm_pep_reference`
- onboarding-owned applicant PEP facts -> `pep`

### Why This Matters

- The current UI/search use case for the global PEP universe is served by `ftm_pep_reference`.
- Copying all external PEPs into `pep` adds complexity without a defined business use case.
- Future agents should preserve the distinction between reference data and onboarding-owned operational data.

---

**Remember: We're in development. Modify the base schema directly. We can always reset!**
