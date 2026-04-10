-- ============================================
-- Migration 2: Functions and RLS Policies
-- ============================================

-- Create security definer function for checking user roles
CREATE OR REPLACE FUNCTION public.has_role("_user_id" uuid, "_role" public.app_role) RETURNS boolean
  LANGUAGE "sql" STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
$$;
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER
  LANGUAGE "plpgsql"
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE "plpgsql"
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
  INSERT INTO public.profile (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_supply_analytics("p_customer_id" uuid DEFAULT NULL)
RETURNS TABLE (
  element_symbol text,
  min_concentration double precision,
  max_concentration double precision,
  avg_concentration double precision,
  median_concentration double precision,
  sample_count bigint
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SET statement_timeout = '60s'
AS $$
  -- Optimized query with proper join order and indexes
  -- Multi-tenant: customer_origins → supply → supply_elements → elements (filtered by customer_id)
  -- Single-tenant: supply → supply_elements → elements (all data)
  -- Uses LEFT JOIN instead of subquery for better performance
  SELECT 
    e.symbol AS element_symbol,
    MIN(se.concentration)::double precision AS min_concentration,
    MAX(se.concentration)::double precision AS max_concentration,
    AVG(se.concentration)::double precision AS avg_concentration,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY se.concentration) AS median_concentration,
    COUNT(*)::bigint AS sample_count
  FROM supply s
  INNER JOIN supply_elements se ON se.supply_id = s.id
  INNER JOIN elements e ON e.id = se.element_id
  LEFT JOIN customer_origins co ON co.origin_id = s.declared_origin_id AND co.customer_id = p_customer_id
  WHERE p_customer_id IS NULL OR co.customer_id IS NOT NULL
  GROUP BY e.symbol
  ORDER BY e.symbol;
$$;
-- Truncate supply tables (much faster than DELETE for bulk operations)
CREATE OR REPLACE FUNCTION public.truncate_supply_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
BEGIN
  -- Truncate supply_elements first (child table)
  TRUNCATE TABLE supply_elements RESTART IDENTITY CASCADE;
  
  -- Then truncate supply (parent table)
  TRUNCATE TABLE supply RESTART IDENTITY CASCADE;
END;
$$;
-- Function to get distinct element symbols for a customer's supplies
-- This avoids RLS issues and limit hacks when querying supply_elements

CREATE OR REPLACE FUNCTION public.get_customer_elements("p_customer_id" uuid)
RETURNS TABLE(symbol TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET statement_timeout = '30s'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT e.symbol
  FROM customer_origins co
  INNER JOIN supply s ON s.declared_origin_id = co.origin_id
  INNER JOIN supply_elements se ON se.supply_id = s.id
  INNER JOIN elements e ON e.id = se.element_id
  WHERE co.customer_id = p_customer_id;
END;
$$;
-- Function to count supply samples for a customer
CREATE OR REPLACE FUNCTION public.get_customer_supply_count("p_customer_id" uuid)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET statement_timeout = '30s'
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM supply s
    INNER JOIN customer_origins co ON s.declared_origin_id = co.origin_id
    WHERE co.customer_id = p_customer_id
  );
END;
$$;
-- ============================================
-- User Management RPC Functions
-- Only accessible by users with 'vendor' role
-- ============================================

-- Helper function to check if current user is vendor
CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'vendor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Get all users with their profiles and roles
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  organization TEXT,
  role TEXT,
  phone TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is vendor
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can access user management';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    p.full_name,
    p.organization,
    COALESCE(ur.role::TEXT, 'operator') as role,
    au.phone,
    au.last_sign_in_at,
    au.created_at
  FROM auth.users au
  LEFT JOIN public.profile p ON p.user_id = au.id
  LEFT JOIN public.user_roles ur ON ur.user_id = au.id
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql;
-- Create new user
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_organization TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user is vendor
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can create users';
  END IF;

  -- Validate role
  IF p_role NOT IN ('vendor', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Invalid role: must be vendor, manager, or operator';
  END IF;

  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    phone,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    p_phone,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'organization', p_organization),
    NOW(),
    NOW(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- Create profile
  INSERT INTO public.profiles ("user_id", "full_name", "organization")
  VALUES (v_user_id, p_full_name, p_organization);

  -- Create role
  INSERT INTO public.user_roles ("user_id", "role")
  VALUES (v_user_id, p_role::app_role);

  RETURN v_user_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
-- Update user
CREATE OR REPLACE FUNCTION public.admin_update_user(
  "p_user_id" uuid,
  "p_full_name" TEXT DEFAULT NULL,
  "p_role" TEXT DEFAULT NULL,
  "p_organization" TEXT DEFAULT NULL,
  "p_phone" TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is vendor
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can update users';
  END IF;

  -- Update profile if fields provided
  IF p_full_name IS NOT NULL OR p_organization IS NOT NULL THEN
    UPDATE public.profile
    SET 
      full_name = COALESCE(p_full_name, full_name),
      organization = COALESCE(p_organization, organization)
    WHERE user_id = p_user_id;
  END IF;

  -- Update role if provided
  IF p_role IS NOT NULL THEN
    IF p_role NOT IN ('vendor', 'manager', 'operator') THEN
      RAISE EXCEPTION 'Invalid role: must be vendor, manager, or operator';
    END IF;

    UPDATE public.user_roles
    SET role = p_role::app_role
    WHERE user_id = p_user_id;
    
    -- If no row was updated, insert new role
    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (p_user_id, p_role::app_role);
    END IF;
  END IF;

  -- Update phone if provided
  IF p_phone IS NOT NULL THEN
    UPDATE auth.users
    SET phone = p_phone
    WHERE id = p_user_id;
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
-- Reset user password
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  "p_user_id" uuid,
  "p_new_password" TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is vendor
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can reset passwords';
  END IF;

  -- Update password
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to reset password: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
-- Delete user
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  "p_user_id" uuid
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is vendor
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can delete users';
  END IF;

  -- Prevent self-deletion
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete from auth.users (will cascade to profiles and user_roles)
  DELETE FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
-- ============================================
-- Supply Distribution Analytics
-- ============================================

/**
 * Get supply count grouped by origin code
 * 
 * Simple aggregation: COUNT(*) per origin
 * No declared vs predicted distinction - just total count
 * 
 * @param p_customer_id - Optional customer filter (multi-tenant support)
 * @returns JSON with origin statistics
 */
CREATE OR REPLACE FUNCTION public.get_supply_by_origin("p_customer_id"  uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  WITH origin_counts AS (
    SELECT 
      o.id AS origin_id,
      o.code AS origin_code,
      o.name AS origin_name,
      COUNT(s.id) AS supply_count
    FROM origins o
    LEFT JOIN supply s ON s.declared_origin_id = o.id
    WHERE 
      -- Filter by customer: either no customer filter, or origin must be linked to customer
      p_customer_id IS NULL 
      OR EXISTS (
        SELECT 1 
        FROM customer_origins co 
        WHERE co.origin_id = o.id 
        AND co.customer_id = p_customer_id
      )
    GROUP BY o.id, o.code, o.name
    HAVING COUNT(s.id) > 0
    ORDER BY COUNT(s.id) DESC, o.code ASC
  ),
  totals AS (
    SELECT 
      COUNT(DISTINCT s.id) AS total_supplies
    FROM supply s
    WHERE 
      -- Filter supplies by customer: either no customer filter, or supply origin must be linked to customer
      p_customer_id IS NULL 
      OR EXISTS (
        SELECT 1 
        FROM customer_origins co 
        WHERE co.origin_id = s.declared_origin_id 
        AND co.customer_id = p_customer_id
      )
  )
  SELECT json_build_object(
    'origins', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'originId', origin_id,
          'originCode', origin_code,
          'originName', origin_name,
          'supplyCount', supply_count
        )
      ) FROM origin_counts),
      '[]'::json
    ),
    'totalSupplies', (SELECT total_supplies FROM totals),
    'totalOrigins', (SELECT COUNT(*) FROM origin_counts),
    'averageSuppliesPerOrigin', (
      SELECT ROUND(AVG(supply_count)::numeric, 2)
      FROM origin_counts
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
-- Add comment
COMMENT ON FUNCTION public.get_supply_by_origin(uuid) IS 
  'Returns supply count grouped by origin code with optional customer filter';
-- Fix get_supply_by_origin function
-- Issue: Function was trying to access s.customer_id which doesn't exist in supply table
-- Solution: Use customer_origins junction table to filter by customer

CREATE OR REPLACE FUNCTION public.get_supply_by_origin("p_customer_id"  uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  WITH origin_counts AS (
    SELECT 
      o.id AS origin_id,
      o.code AS origin_code,
      o.name AS origin_name,
      COUNT(s.id) AS supply_count
    FROM origins o
    LEFT JOIN supply s ON s.declared_origin_id = o.id
    WHERE 
      -- Filter by customer: either no customer filter, or origin must be linked to customer
      p_customer_id IS NULL 
      OR EXISTS (
        SELECT 1 
        FROM customer_origins co 
        WHERE co.origin_id = o.id 
        AND co.customer_id = p_customer_id
      )
    GROUP BY o.id, o.code, o.name
    HAVING COUNT(s.id) > 0
    ORDER BY COUNT(s.id) DESC, o.code ASC
  ),
  totals AS (
    SELECT 
      COUNT(DISTINCT s.id) AS total_supplies
    FROM supply s
    WHERE 
      -- Filter supplies by customer: either no customer filter, or supply origin must be linked to customer
      p_customer_id IS NULL 
      OR EXISTS (
        SELECT 1 
        FROM customer_origins co 
        WHERE co.origin_id = s.declared_origin_id 
        AND co.customer_id = p_customer_id
      )
  )
  SELECT json_build_object(
    'origins', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'originId', origin_id,
          'originCode', origin_code,
          'originName', origin_name,
          'supplyCount', supply_count
        )
      ) FROM origin_counts),
      '[]'::json
    ),
    'totalSupplies', (SELECT total_supplies FROM totals),
    'totalOrigins', (SELECT COUNT(*) FROM origin_counts),
    'averageSuppliesPerOrigin', (
      SELECT ROUND(AVG(supply_count)::numeric, 2)
      FROM origin_counts
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
-- Function: Get origins for a specific customer
-- Returns all origins that belong to a customer via customer_origins relationship
-- Used for Single Tenant Mode filtering

CREATE OR REPLACE FUNCTION public.get_origins_for_customer("p_customer_id" uuid)
RETURNS TABLE (
  id uuid,
  code TEXT,
  name TEXT,
  country_id uuid,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    o.id,
    o.code,
    o.name,
    o.country_id,
    o.created_at,
    o.updated_at
  FROM origins o
  INNER JOIN customer_origins co ON o.id = co.origin_id
  WHERE co.customer_id = p_customer_id
  ORDER BY o.code;
$$;
COMMENT ON FUNCTION public.get_origins_for_customer(uuid) IS 
'Returns all origins for a specific customer. Used in Single Tenant Mode to filter origins by customer relationship.';
-- =====================================================
-- Origin ID Mapping Batch Delete Function
-- =====================================================
-- This function handles deletion of multiple origin_id_mapping records
-- efficiently by accepting an array of IDs, avoiding URL length limits
-- that occur with large IN clauses in HTTP requests.
CREATE OR REPLACE FUNCTION public.delete_origin_id_mappings_batch("mapping_ids"  UUID[])
RETURNS TABLE(deleted_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete all records matching the provided IDs
  DELETE FROM origin_id_mapping
  WHERE id = ANY(mapping_ids);
  
  -- Get the count of deleted rows
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Return the count
  RETURN QUERY SELECT v_deleted_count;
END;
$$;
-- Add comment for documentation
COMMENT ON FUNCTION public.delete_origin_id_mappings_batch(UUID[]) IS 
  'Batch delete origin ID mappings by array of IDs. Returns count of deleted records.';
-- Function to get elements that exist in supply_elements table
CREATE OR REPLACE FUNCTION public.get_elements_in_supply_data()
RETURNS TABLE (
  id UUID,
  symbol TEXT,
  name TEXT,
  atomic_number INTEGER
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT e.id, e.symbol, e.name, e.atomic_number
  FROM elements e
  INNER JOIN supply_elements se ON e.id = se.element_id
  ORDER BY e.atomic_number;
END;
$$;
