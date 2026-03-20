-- ============================================
-- MIGRATION: Schema Reset
-- Purpose: Complete clean slate for development - drops and recreates entire schema
-- Date: 2025-11-05
-- ============================================
-- WARNING: This migration destroys ALL data and schema in the public schema.
-- Only use this for development environments or when you explicitly want a clean reset.
-- This should be the FIRST migration (lowest timestamp) so it runs before all others.
-- ============================================

-- ============================================
-- 1. Drop all functions
-- ============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all functions in public schema
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS ' || ns.nspname || '.' || proname 
               || '(' || oidvectortypes(proargtypes) || ') CASCADE;' as drop_statement
        FROM pg_proc 
        INNER JOIN pg_namespace ns ON (pg_proc.pronamespace = ns.oid)
        WHERE ns.nspname = 'public'
    ) LOOP
        EXECUTE r.drop_statement;
    END LOOP;
    
    RAISE NOTICE 'All functions dropped';
END $$;
-- ============================================
-- 2. Drop all custom types
-- ============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'DROP TYPE IF EXISTS public.' || typname || ' CASCADE;' as drop_statement
        FROM pg_type t
        INNER JOIN pg_namespace ns ON t.typnamespace = ns.oid
        WHERE ns.nspname = 'public' 
        AND t.typtype = 'e' -- enum types
    ) LOOP
        EXECUTE r.drop_statement;
    END LOOP;
    
    RAISE NOTICE 'All custom types dropped';
END $$;
-- ============================================
-- 3. Drop all constraints
-- ============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname, conrelid::regclass 
        FROM pg_constraint 
        WHERE connamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'ALTER TABLE ' || r.conrelid || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;
    
    RAISE NOTICE 'All constraints dropped';
END $$;
-- ============================================
-- 4. Drop all indexes
-- ============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.indexname) || ' CASCADE';
    END LOOP;
    
    RAISE NOTICE 'All indexes dropped';
END $$;
-- ============================================
-- 5. Drop all triggers
-- ============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || 
                ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE';
    END LOOP;
    
    RAISE NOTICE 'All triggers dropped';
END $$;
-- ============================================
-- 6. Drop all views
-- ============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
    END LOOP;
    
    RAISE NOTICE 'All views dropped';
END $$;
-- ============================================
-- 7. Drop all tables
-- ============================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    RAISE NOTICE 'All tables dropped';
END $$;
-- ============================================
-- 8. Drop and recreate the public schema
-- ============================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
-- Grant permissions on schema
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
COMMENT ON SCHEMA public IS 'Standard public schema';
-- ============================================
-- Success Message
-- ============================================
-- Note: Extensions are created in 20250101000100_schema_setup.sql
-- to avoid duplication and ensure proper initialization order
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema reset completed successfully';
  RAISE NOTICE 'Public schema has been dropped and recreated';
  RAISE NOTICE 'All subsequent migrations will now run';
  RAISE NOTICE '============================================';
END $$;
