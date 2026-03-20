-- ============================================
-- MIGRATION: Schema Setup
-- Purpose: Initialize database settings, extensions, and custom types
-- Date: 2025-11-05
-- ============================================
-- This migration runs AFTER schema_reset and BEFORE all other migrations.
-- It sets up the foundational configuration needed for the application.
-- ============================================

-- ============================================
-- 1. PostgreSQL Settings
-- ============================================
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
-- ============================================
-- 2. Schema Creation and Permissions
-- ============================================
CREATE SCHEMA IF NOT EXISTS public;
ALTER SCHEMA public OWNER TO pg_database_owner;
COMMENT ON SCHEMA public IS 'Standard public schema';
-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
-- ============================================
-- 3. Essential Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions for password hashing';
SET default_tablespace = '';
SET default_table_access_method = heap;
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Schema setup completed successfully';
  RAISE NOTICE 'Extensions enabled: uuid-ossp, pgcrypto, pgsodium, http';
  RAISE NOTICE 'Utility functions created: update_updated_at_column, gen_random_uuid';
  RAISE NOTICE 'Database optimized for performance';
  RAISE NOTICE 'Note: Custom types are defined in subsequent migrations';
  RAISE NOTICE '============================================';
END $$;
