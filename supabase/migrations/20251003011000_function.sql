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

-- Canonical role lookup for the authenticated user (single role per user, M4)
CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $$
    SELECT "role"::text
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
    LIMIT 1;
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

-- ============================================
-- Closed-Group Messaging read RPCs (M6)
-- SECURITY DEFINER, fixed search_path, minimal grants.
-- ============================================

CREATE OR REPLACE FUNCTION public.display_name_for_user(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF((SELECT full_name FROM public.profile WHERE user_id = p_user_id), ''),
    NULLIF((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id), ''),
    NULLIF(split_part((SELECT email FROM auth.users WHERE id = p_user_id), '@', 1), ''),
    'User ' || left(p_user_id::text, 8)
  );
$$;

CREATE OR REPLACE FUNCTION public.organization_for_user(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization FROM public.profile WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.list_participants()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'userId', u.id,
        'displayName', public.display_name_for_user(u.id),
        'organization', public.organization_for_user(u.id)
      )
      ORDER BY lower(public.display_name_for_user(u.id))
    ),
    '[]'::jsonb
  )
  FROM auth.users u
  WHERE u.id <> (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.list_conversations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(obj ORDER BY (obj->>'lastMessageAt') DESC NULLS LAST),
    '[]'::jsonb
  )
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'counterpartyUserId',
        CASE WHEN c.participant_low_user_id = (SELECT auth.uid())
             THEN c.participant_high_user_id
             ELSE c.participant_low_user_id END,
      'counterpartyDisplayName',
        public.display_name_for_user(
          CASE WHEN c.participant_low_user_id = (SELECT auth.uid())
               THEN c.participant_high_user_id
               ELSE c.participant_low_user_id END
        ),
      'counterpartyOrganization',
        public.organization_for_user(
          CASE WHEN c.participant_low_user_id = (SELECT auth.uid())
               THEN c.participant_high_user_id
               ELSE c.participant_low_user_id END
        ),
      'lastMessageAt', c.last_message_at,
      'lastMessage', (
        SELECT m.content
        FROM public.messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ),
      'createdAt', c.created_at
    ) AS obj
    FROM public.conversations c
    WHERE c.participant_low_user_id = (SELECT auth.uid())
       OR c.participant_high_user_id = (SELECT auth.uid())
  ) sub;
$$;

CREATE OR REPLACE FUNCTION public.list_messages(
  p_conversation_id uuid,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows jsonb;
  v_next jsonb := NULL;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id
      AND (participant_low_user_id = auth.uid() OR participant_high_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COALESCE(
    jsonb_agg(msg ORDER BY (msg->>'createdAt') DESC, (msg->>'id') DESC),
    '[]'::jsonb
  ) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', m.id,
      'conversationId', m.conversation_id,
      'senderUserId', m.sender_user_id,
      'recipientUserId', m.recipient_user_id,
      'type', m.type,
      'content', m.content,
      'createdAt', m.created_at
    ) AS msg
    FROM public.messages m
    WHERE m.conversation_id = p_conversation_id
      AND (
        (p_cursor_created_at IS NULL AND p_cursor_id IS NULL)
        OR (m.created_at, m.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT LEAST(p_limit, 100)
  ) t;

  IF jsonb_array_length(v_rows) > 0 AND jsonb_array_length(v_rows) >= LEAST(p_limit, 100) THEN
    v_next := jsonb_build_object(
      'createdAt', v_rows->(jsonb_array_length(v_rows) - 1)->>'createdAt',
      'id', v_rows->(jsonb_array_length(v_rows) - 1)->>'id'
    );
  END IF;

  RETURN jsonb_build_object('messages', v_rows, 'nextCursor', v_next);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_message(p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_json jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT jsonb_build_object(
    'id', m.id,
    'conversationId', m.conversation_id,
    'senderUserId', m.sender_user_id,
    'recipientUserId', m.recipient_user_id,
    'type', m.type,
    'content', m.content,
    'createdAt', m.created_at
  ) INTO v_json
  FROM public.messages m
  WHERE m.id = p_message_id
    AND (m.sender_user_id = auth.uid() OR m.recipient_user_id = auth.uid());

  RETURN v_json;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dispatch(p_dispatch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dispatch jsonb;
  v_recipients jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT jsonb_build_object(
    'id', d.id,
    'messageType', d.message_type,
    'content', d.content,
    'status', d.status,
    'createdAt', d.created_at
  ) INTO v_dispatch
  FROM public.message_dispatch d
  WHERE d.id = p_dispatch_id AND d.sender_user_id = auth.uid();

  IF v_dispatch IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'requestedRecipientUserId', r.requested_recipient_user_id,
        'recipientUserId', r.recipient_user_id,
        'status', r.status,
        'errorCode', r.error_code,
        'messageId', r.message_id
      )
      ORDER BY r.requested_recipient_user_id
    ),
    '[]'::jsonb
  ) INTO v_recipients
  FROM public.message_dispatch_recipient r
  WHERE r.dispatch_id = p_dispatch_id;

  RETURN v_dispatch || jsonb_build_object('recipients', v_recipients);
END;
$$;

-- ============================================
-- Closed-Group Messaging conversation resolver (M7)
-- Internal only: not granted to browser roles.
-- ============================================

CREATE OR REPLACE FUNCTION public.resolve_bilateral_conversation(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_low uuid;
  v_high uuid;
  v_conversation_id uuid;
BEGIN
  IF p_user_a = p_user_b THEN
    RAISE EXCEPTION 'self_recipient';
  END IF;

  IF p_user_a < p_user_b THEN
    v_low := p_user_a;
    v_high := p_user_b;
  ELSE
    v_low := p_user_b;
    v_high := p_user_a;
  END IF;

  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE participant_low_user_id = v_low AND participant_high_user_id = v_high;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations (participant_low_user_id, participant_high_user_id)
  VALUES (v_low, v_high)
  ON CONFLICT (participant_low_user_id, participant_high_user_id) DO NOTHING
  RETURNING id INTO v_conversation_id;

  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM public.conversations
    WHERE participant_low_user_id = v_low AND participant_high_user_id = v_high;
  END IF;

  RETURN v_conversation_id;
END;
$$;

-- ============================================
-- RFQ read helpers and RPCs (M8)
-- ============================================

CREATE OR REPLACE FUNCTION public.effective_quote_status(p_request_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN q.status = 'converted' THEN 'converted'
    WHEN q.response_deadline IS NULL OR clock_timestamp() < q.response_deadline THEN 'open'
    ELSE 'expired'
  END
  FROM public.quote_requests q
  WHERE q.id = p_request_id;
$$;

CREATE OR REPLACE FUNCTION public.list_quote_invitations()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_json jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT COALESCE(
    jsonb_agg(obj ORDER BY (obj->>'createdAt') DESC),
    '[]'::jsonb
  ) INTO v_json
  FROM (
    SELECT jsonb_build_object(
      'id', i.id,
      'requestId', i.request_id,
      'recipientUserId', i.recipient_user_id,
      'ownerUserId', q.owner_user_id,
      'conversationId', i.conversation_id,
      'messageId', i.message_id,
      'createdAt', i.created_at,
      'effectiveStatus', public.effective_quote_status(i.request_id),
      'terms', q.terms
    ) AS obj
    FROM public.quote_request_invitations i
    JOIN public.quote_requests q ON q.id = i.request_id
    WHERE i.recipient_user_id = auth.uid()
       OR q.owner_user_id = auth.uid()
  ) t;

  RETURN v_json;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_quote_responses(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_json jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quote_request_invitations i
    WHERE i.id = p_invitation_id
      AND (
        i.recipient_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.quote_requests q
          WHERE q.id = i.request_id AND q.owner_user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COALESCE(
    jsonb_agg(obj ORDER BY (obj->>'createdAt') ASC, (obj->>'id') ASC),
    '[]'::jsonb
  ) INTO v_json
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'invitationId', r.invitation_id,
      'parentResponseId', r.parent_response_id,
      'responderUserId', r.responder_user_id,
      'createdAt', r.created_at,
      'status', r.status,
      'decision', d.decision,
      'quotedPremium', r.quoted_premium,
      'notes', r.notes,
      'allowedActions',
        CASE
          WHEN d.decision IS NOT NULL THEN '[]'::jsonb
          WHEN public.effective_quote_status(i.request_id) <> 'open' THEN '[]'::jsonb
          WHEN q.owner_user_id = auth.uid() THEN
            CASE WHEN r.responder_user_id = i.recipient_user_id
                 THEN '["counter","reject","book"]'::jsonb
                 ELSE '["counter"]'::jsonb
            END
          ELSE '["counter"]'::jsonb
        END
    ) AS obj
    FROM public.quote_responses r
    JOIN public.quote_request_invitations i ON i.id = r.invitation_id
    JOIN public.quote_requests q ON q.id = i.request_id
    LEFT JOIN public.quote_response_decisions d ON d.response_id = r.id
    WHERE r.invitation_id = p_invitation_id
  ) t;

  RETURN v_json;
END;
$$;

-- ============================================
-- Closed-Group Messaging send_messages (M9)
-- ============================================

CREATE OR REPLACE FUNCTION public.raise_business_error(p_code text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '%', p_code
    USING ERRCODE = 'P0001',
          DETAIL = jsonb_build_object('code', p_code, 'details', p_details)::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_rfq_terms(p_terms jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_required text[] := ARRAY['quantity','product','productCode','productClass','quality','location','priceBasis','premium','rawTerms'];
  v_optional text[] := ARRAY['fees','vat','notes'];
  v_key text;
  v_value jsonb;
  v_scalar text;
  v_ttl numeric;
BEGIN
  IF p_terms IS NULL OR jsonb_typeof(p_terms) <> 'object' THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_terms) k
    WHERE k NOT IN ('quantity','product','productCode','productClass','quality','location','priceBasis','premium','fees','vat','notes','rawTerms','responseTtlSeconds')
  ) THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  FOREACH v_key IN ARRAY v_required LOOP
    v_value := p_terms->v_key;
    IF jsonb_typeof(v_value) <> 'string' THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
    v_scalar := trim(v_value#>>'{}');
    IF v_key = 'rawTerms' THEN
      IF length(v_scalar) < 1 OR length(v_scalar) > 5000 THEN
        PERFORM public.raise_business_error('invalid_rfq_terms');
      END IF;
    ELSIF length(v_scalar) < 1 OR length(v_scalar) > 500 THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
    v_result := v_result || jsonb_build_object(v_key, v_scalar);
  END LOOP;

  IF NOT (v_result->>'productClass') IN ('gold','silver','platinum','palladium','other') THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  FOREACH v_key IN ARRAY v_optional LOOP
    v_value := p_terms->v_key;
    IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' THEN
      v_result := v_result || jsonb_build_object(v_key, NULL::text);
    ELSIF jsonb_typeof(v_value) <> 'string' THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    ELSE
      v_scalar := trim(v_value#>>'{}');
      IF v_key = 'notes' THEN
        IF length(v_scalar) > 2000 THEN
          PERFORM public.raise_business_error('invalid_rfq_terms');
        END IF;
      ELSIF length(v_scalar) > 500 THEN
        PERFORM public.raise_business_error('invalid_rfq_terms');
      END IF;
      IF length(v_scalar) = 0 THEN
        v_result := v_result || jsonb_build_object(v_key, NULL::text);
      ELSE
        v_result := v_result || jsonb_build_object(v_key, v_scalar);
      END IF;
    END IF;
  END LOOP;

  v_value := p_terms->'responseTtlSeconds';
  IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' THEN
    v_result := v_result || jsonb_build_object('responseTtlSeconds', NULL::int);
  ELSIF jsonb_typeof(v_value) <> 'number' THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  ELSE
    v_ttl := v_value::numeric;
    IF v_ttl <> floor(v_ttl) OR v_ttl < 60 OR v_ttl > 86400 THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
    v_result := v_result || jsonb_build_object('responseTtlSeconds', v_ttl::int);
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_messages(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_dispatch_id uuid;
  v_message_type text;
  v_content text;
  v_recipient_ids uuid[] := ARRAY[]::uuid[];
  v_retry_recipient_ids uuid[] := ARRAY[]::uuid[];
  v_has_retry boolean := false;
  v_recipient_raw text;
  v_recipient_id uuid;
  v_rfq_terms jsonb;
  v_rfq_id uuid;
  v_ttl int;
  v_response_deadline timestamptz;
  v_is_retry boolean;
  v_dispatch_sender uuid;
  v_dispatch_message_type text;
  v_dispatch_content text;
  v_dispatch_rfq_id uuid;
  v_stored_terms jsonb;
  v_conversation_id uuid;
  v_message_id uuid;
  v_recipient_results jsonb := '[]'::jsonb;
  v_messages jsonb := '[]'::jsonb;
  v_accepted int;
  v_rejected int;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN
    PERFORM public.raise_business_error('invalid_request');
  END IF;

  BEGIN
    v_dispatch_id := (request->>'dispatchId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  v_message_type := request->>'messageType';
  IF v_message_type NOT IN ('standard','rfq') THEN
    PERFORM public.raise_business_error('invalid_message_type');
  END IF;

  v_content := trim(COALESCE(request->>'content', ''));
  IF length(v_content) < 1 OR length(v_content) > 10000 THEN
    PERFORM public.raise_business_error('invalid_request');
  END IF;

  IF jsonb_typeof(request->'recipientIds') <> 'array' THEN
    PERFORM public.raise_business_error('invalid_request');
  END IF;

  FOR v_recipient_raw IN SELECT jsonb_array_elements_text(request->'recipientIds') LOOP
    BEGIN
      v_recipient_id := v_recipient_raw::uuid;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.raise_business_error('invalid_request');
    END;
    IF NOT v_recipient_id = ANY(v_recipient_ids) THEN
      v_recipient_ids := v_recipient_ids || v_recipient_id;
    END IF;
  END LOOP;

  IF coalesce(array_length(v_recipient_ids, 1), 0) = 0 OR array_length(v_recipient_ids, 1) > 100 THEN
    PERFORM public.raise_business_error('invalid_request');
  END IF;

  SELECT array_agg(x ORDER BY x) INTO v_recipient_ids
  FROM (SELECT DISTINCT unnest(v_recipient_ids) AS x) t;

  IF request ? 'retryRecipientIds' AND jsonb_typeof(request->'retryRecipientIds') <> 'null' THEN
    IF jsonb_typeof(request->'retryRecipientIds') <> 'array' THEN
      PERFORM public.raise_business_error('invalid_request');
    END IF;
    v_has_retry := true;
    FOR v_recipient_raw IN SELECT jsonb_array_elements_text(request->'retryRecipientIds') LOOP
      BEGIN
        v_recipient_id := v_recipient_raw::uuid;
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.raise_business_error('invalid_request');
      END;
      IF NOT v_recipient_id = ANY(v_retry_recipient_ids) THEN
        v_retry_recipient_ids := v_retry_recipient_ids || v_recipient_id;
      END IF;
    END LOOP;
    IF coalesce(array_length(v_retry_recipient_ids, 1), 0) = 0 THEN
      PERFORM public.raise_business_error('invalid_retry_subset');
    END IF;
    SELECT array_agg(x ORDER BY x) INTO v_retry_recipient_ids
    FROM (SELECT DISTINCT unnest(v_retry_recipient_ids) AS x) t;
  END IF;

  IF v_message_type = 'rfq' THEN
    v_rfq_terms := public.normalize_rfq_terms(request->'rfqTerms');
  ELSIF request ? 'rfqTerms' AND jsonb_typeof(request->'rfqTerms') <> 'null' THEN
    PERFORM public.raise_business_error('invalid_request');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dispatch_id::text));

  SELECT sender_user_id, message_type, content, quote_request_id
    INTO v_dispatch_sender, v_dispatch_message_type, v_dispatch_content, v_dispatch_rfq_id
    FROM public.message_dispatch WHERE id = v_dispatch_id;
  v_is_retry := v_dispatch_sender IS NOT NULL;

  IF v_is_retry THEN
    IF v_dispatch_sender <> v_uid THEN
      PERFORM public.raise_business_error('dispatch_owned_by_other_user');
    END IF;

    IF v_dispatch_message_type <> v_message_type OR v_dispatch_content <> v_content THEN
      PERFORM public.raise_business_error('dispatch_payload_mismatch');
    END IF;

    IF v_message_type = 'rfq' THEN
      SELECT terms INTO v_stored_terms FROM public.quote_requests WHERE id = v_dispatch_rfq_id;
      IF v_stored_terms IS DISTINCT FROM v_rfq_terms THEN
        PERFORM public.raise_business_error('dispatch_payload_mismatch');
      END IF;
      v_rfq_id := v_dispatch_rfq_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.message_dispatch_recipient
      WHERE dispatch_id = v_dispatch_id
        AND NOT (requested_recipient_user_id = ANY(v_recipient_ids))
    ) OR EXISTS (
      SELECT 1 FROM unnest(v_recipient_ids) r(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.message_dispatch_recipient
        WHERE dispatch_id = v_dispatch_id AND requested_recipient_user_id = r.id
      )
    ) THEN
      PERFORM public.raise_business_error('dispatch_payload_mismatch');
    END IF;

    IF v_has_retry THEN
      IF EXISTS (
        SELECT 1 FROM unnest(v_retry_recipient_ids) r(id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.message_dispatch_recipient
          WHERE dispatch_id = v_dispatch_id
            AND requested_recipient_user_id = r.id
            AND status = 'rejected'
        )
      ) THEN
        PERFORM public.raise_business_error('invalid_retry_subset');
      END IF;
    END IF;
  ELSE
    IF v_has_retry THEN
      PERFORM public.raise_business_error('invalid_request');
    END IF;

    v_rfq_id := NULL;
    IF v_message_type = 'rfq' THEN
      v_ttl := (v_rfq_terms->>'responseTtlSeconds')::int;
      v_response_deadline := CASE WHEN v_ttl IS NOT NULL THEN now() + make_interval(secs => v_ttl) ELSE NULL END;
      INSERT INTO public.quote_requests (owner_user_id, terms, status, response_deadline)
      VALUES (v_uid, v_rfq_terms, 'open', v_response_deadline)
      RETURNING id INTO v_rfq_id;
    END IF;

    INSERT INTO public.message_dispatch (id, sender_user_id, message_type, content, quote_request_id, status)
    VALUES (v_dispatch_id, v_uid, v_message_type, v_content, v_rfq_id, 'failed')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF v_is_retry AND v_has_retry THEN
    FOR v_recipient_id IN SELECT unnest(v_retry_recipient_ids) LOOP
      IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_recipient_id FOR KEY SHARE) THEN
        UPDATE public.message_dispatch_recipient
        SET status = 'rejected', error_code = 'recipient_not_found', recipient_user_id = NULL, message_id = NULL
        WHERE dispatch_id = v_dispatch_id AND requested_recipient_user_id = v_recipient_id;
        CONTINUE;
      END IF;

      v_conversation_id := public.resolve_bilateral_conversation(v_uid, v_recipient_id);

      INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, type, content, quote_request_id)
      VALUES (v_conversation_id, v_uid, v_recipient_id, v_message_type, v_content, v_rfq_id)
      RETURNING id INTO v_message_id;

      IF v_message_type = 'rfq' THEN
        INSERT INTO public.quote_request_invitations (request_id, recipient_user_id, conversation_id, message_id)
        VALUES (v_rfq_id, v_recipient_id, v_conversation_id, v_message_id);
      END IF;

      UPDATE public.message_dispatch_recipient
      SET status = 'accepted', recipient_user_id = v_recipient_id, message_id = v_message_id, error_code = NULL
      WHERE dispatch_id = v_dispatch_id AND requested_recipient_user_id = v_recipient_id;

      v_messages := v_messages || jsonb_build_object(
        'recipientUserId', v_recipient_id,
        'message', jsonb_build_object(
          'id', v_message_id, 'conversationId', v_conversation_id,
          'senderUserId', v_uid, 'recipientUserId', v_recipient_id,
          'type', v_message_type, 'content', v_content, 'createdAt', now(), 'quoteRequestId', v_rfq_id
        )
      );

      BEGIN
        PERFORM realtime.send(
          jsonb_build_object('messageId', v_message_id, 'conversationId', v_conversation_id, 'messageType', v_message_type),
          'message.created',
          'user:' || v_recipient_id,
          true
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'realtime enqueue failed for dispatch %', v_dispatch_id;
      END;
    END LOOP;
  ELSIF v_is_retry THEN
    -- Idempotent full replay: the dispatch was already committed with the same
    -- payload and no retry subset was requested, so return the stored result
    -- without writing anything.
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'recipientUserId', m.recipient_user_id,
          'message', jsonb_build_object(
            'id', m.id,
            'conversationId', m.conversation_id,
            'senderUserId', m.sender_user_id,
            'recipientUserId', m.recipient_user_id,
            'type', m.type,
            'content', m.content,
            'createdAt', m.created_at,
            'quoteRequestId', m.quote_request_id
          )
        )
        ORDER BY m.created_at ASC, m.id ASC
      ),
      '[]'::jsonb
    ) INTO v_messages
    FROM public.messages m
    WHERE m.id IN (
      SELECT r.message_id
      FROM public.message_dispatch_recipient r
      WHERE r.dispatch_id = v_dispatch_id AND r.status = 'accepted'
    );
  ELSE
    FOR v_recipient_id IN SELECT unnest(v_recipient_ids) LOOP
      IF v_recipient_id = v_uid THEN
        INSERT INTO public.message_dispatch_recipient (dispatch_id, requested_recipient_user_id, status, error_code)
        VALUES (v_dispatch_id, v_recipient_id, 'rejected', 'self_recipient')
        ON CONFLICT (dispatch_id, requested_recipient_user_id) DO NOTHING;
        CONTINUE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_recipient_id FOR KEY SHARE) THEN
        INSERT INTO public.message_dispatch_recipient (dispatch_id, requested_recipient_user_id, status, error_code)
        VALUES (v_dispatch_id, v_recipient_id, 'rejected', 'recipient_not_found')
        ON CONFLICT (dispatch_id, requested_recipient_user_id) DO NOTHING;
        CONTINUE;
      END IF;

      v_conversation_id := public.resolve_bilateral_conversation(v_uid, v_recipient_id);

      INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, type, content, quote_request_id)
      VALUES (v_conversation_id, v_uid, v_recipient_id, v_message_type, v_content, v_rfq_id)
      RETURNING id INTO v_message_id;

      IF v_message_type = 'rfq' THEN
        INSERT INTO public.quote_request_invitations (request_id, recipient_user_id, conversation_id, message_id)
        VALUES (v_rfq_id, v_recipient_id, v_conversation_id, v_message_id);
      END IF;

      INSERT INTO public.message_dispatch_recipient (dispatch_id, requested_recipient_user_id, recipient_user_id, status, message_id)
      VALUES (v_dispatch_id, v_recipient_id, v_recipient_id, 'accepted', v_message_id);

      v_messages := v_messages || jsonb_build_object(
        'recipientUserId', v_recipient_id,
        'message', jsonb_build_object(
          'id', v_message_id, 'conversationId', v_conversation_id,
          'senderUserId', v_uid, 'recipientUserId', v_recipient_id,
          'type', v_message_type, 'content', v_content, 'createdAt', now(), 'quoteRequestId', v_rfq_id
        )
      );

      BEGIN
        PERFORM realtime.send(
          jsonb_build_object('messageId', v_message_id, 'conversationId', v_conversation_id, 'messageType', v_message_type),
          'message.created',
          'user:' || v_recipient_id,
          true
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'realtime enqueue failed for dispatch %', v_dispatch_id;
      END;
    END LOOP;
  END IF;

  SELECT count(*) FILTER (WHERE status = 'accepted'),
         count(*) FILTER (WHERE status = 'rejected')
  INTO v_accepted, v_rejected
  FROM public.message_dispatch_recipient
  WHERE dispatch_id = v_dispatch_id;

  v_status := CASE
    WHEN v_rejected = 0 THEN 'completed'
    WHEN v_accepted = 0 THEN 'failed'
    ELSE 'partial'
  END;

  UPDATE public.message_dispatch SET status = v_status WHERE id = v_dispatch_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'requestedRecipientUserId', r.requested_recipient_user_id,
        'recipientUserId', r.recipient_user_id,
        'status', r.status,
        'errorCode', r.error_code,
        'messageId', r.message_id
      )
      ORDER BY r.requested_recipient_user_id
    ),
    '[]'::jsonb
  ) INTO v_recipient_results
  FROM public.message_dispatch_recipient r
  WHERE r.dispatch_id = v_dispatch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'dispatch', jsonb_build_object(
      'id', v_dispatch_id,
      'status', v_status,
      'messages', v_messages,
      'recipients', v_recipient_results
    )
  );
END;
$$;

-- ============================================
-- RFQ mutation RPCs (M9a)
-- ============================================

CREATE OR REPLACE FUNCTION public.create_workflow_message(
  p_conversation_id uuid,
  p_sender_user_id uuid,
  p_recipient_user_id uuid,
  p_request_id uuid,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, type, content, quote_request_id)
  VALUES (p_conversation_id, p_sender_user_id, p_recipient_user_id, 'rfq', p_content, p_request_id)
  RETURNING id INTO v_message_id;

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('messageId', v_message_id, 'conversationId', p_conversation_id, 'messageType', 'rfq'),
      'message.created',
      'user:' || p_recipient_user_id,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'realtime enqueue failed for workflow message %', v_message_id;
  END;

  RETURN v_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_quote_response(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_invitation_id uuid;
  v_client_response_id uuid;
  v_quoted_premium text;
  v_notes text;
  v_canonical jsonb;
  v_idem public.quote_workflow_idempotency;
  v_idem_exists boolean;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_effective text;
  v_response_id uuid;
  v_message_id uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  BEGIN
    v_invitation_id := (request->>'invitationId')::uuid;
    v_client_response_id := (request->>'clientResponseId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  IF jsonb_typeof(request->'quotedPremium') <> 'string' THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;
  v_quoted_premium := trim(request->>'quotedPremium');
  IF length(v_quoted_premium) < 1 OR length(v_quoted_premium) > 200 THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;

  v_notes := NULL;
  IF request ? 'notes' AND jsonb_typeof(request->'notes') <> 'null' THEN
    IF jsonb_typeof(request->'notes') <> 'string' THEN
      PERFORM public.raise_business_error('invalid_request');
    END IF;
    v_notes := trim(request->>'notes');
    IF length(v_notes) > 2000 THEN
      PERFORM public.raise_business_error('invalid_request');
    END IF;
    IF length(v_notes) = 0 THEN
      v_notes := NULL;
    END IF;
  END IF;

  v_canonical := jsonb_build_object('invitationId', v_invitation_id, 'quotedPremium', v_quoted_premium, 'notes', v_notes);

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_client_response_id::text));

  SELECT EXISTS(
    SELECT 1 FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id
  ) INTO v_idem_exists;
  IF v_idem_exists THEN
    SELECT * INTO v_idem FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id;
    IF v_idem.canonical_request = v_canonical THEN
      RETURN v_idem.result_snapshot;
    END IF;
    PERFORM public.raise_business_error('idempotency_payload_mismatch');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_invitation_id;
  IF v_invitation IS NULL THEN
    PERFORM public.raise_business_error('invitation_not_found');
  END IF;

  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;
  v_effective := public.effective_quote_status(v_request.id);
  IF v_effective = 'expired' THEN PERFORM public.raise_business_error('rfq_expired'); END IF;
  IF v_effective = 'converted' THEN PERFORM public.raise_business_error('rfq_closed'); END IF;

  IF v_invitation.recipient_user_id <> v_uid THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  INSERT INTO public.quote_responses (invitation_id, responder_user_id, parent_response_id, client_response_id, status, quoted_premium, notes)
  VALUES (v_invitation_id, v_uid, NULL, v_client_response_id, 'submitted', v_quoted_premium, v_notes)
  RETURNING id INTO v_response_id;

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_request.owner_user_id, v_request.id,
    'Quote submitted for ' || (v_request.terms->>'quantity') || ' ' || (v_request.terms->>'product') || ' at premium ' || v_quoted_premium
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation_id, 'parentResponseId', NULL,
      'responderUserId', v_uid, 'createdAt', now(), 'status', 'submitted',
      'quotedPremium', v_quoted_premium, 'notes', v_notes
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_request.owner_user_id,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id)
  VALUES (v_uid, v_client_response_id, 'submit', v_canonical, v_result, v_message_id, v_response_id);

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.counter_quote_response(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_parent_response_id uuid;
  v_client_response_id uuid;
  v_quoted_premium text;
  v_notes text;
  v_canonical jsonb;
  v_idem public.quote_workflow_idempotency;
  v_idem_exists boolean;
  v_parent public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_effective text;
  v_counterparty uuid;
  v_response_id uuid;
  v_message_id uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  BEGIN
    v_parent_response_id := (request->>'parentResponseId')::uuid;
    v_client_response_id := (request->>'clientResponseId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  IF jsonb_typeof(request->'quotedPremium') <> 'string' THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;
  v_quoted_premium := trim(request->>'quotedPremium');
  IF length(v_quoted_premium) < 1 OR length(v_quoted_premium) > 200 THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;

  v_notes := NULL;
  IF request ? 'notes' AND jsonb_typeof(request->'notes') <> 'null' THEN
    IF jsonb_typeof(request->'notes') <> 'string' THEN
      PERFORM public.raise_business_error('invalid_request');
    END IF;
    v_notes := trim(request->>'notes');
    IF length(v_notes) > 2000 THEN
      PERFORM public.raise_business_error('invalid_request');
    END IF;
    IF length(v_notes) = 0 THEN
      v_notes := NULL;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_client_response_id::text));

  SELECT EXISTS(
    SELECT 1 FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id
  ) INTO v_idem_exists;
  IF v_idem_exists THEN
    SELECT * INTO v_idem FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id;
    IF v_idem.canonical_request = jsonb_build_object('parentResponseId', v_parent_response_id, 'quotedPremium', v_quoted_premium, 'notes', v_notes) THEN
      RETURN v_idem.result_snapshot;
    END IF;
    PERFORM public.raise_business_error('idempotency_payload_mismatch');
  END IF;

  SELECT * INTO v_parent FROM public.quote_responses WHERE id = v_parent_response_id FOR UPDATE;
  IF v_parent IS NULL THEN
    PERFORM public.raise_business_error('response_not_found');
  END IF;
  IF v_parent.status NOT IN ('submitted', 'countered') THEN
    PERFORM public.raise_business_error('invalid_parent_response');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_parent.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;

  v_effective := public.effective_quote_status(v_request.id);
  IF v_effective = 'expired' THEN PERFORM public.raise_business_error('rfq_expired'); END IF;
  IF v_effective = 'converted' THEN PERFORM public.raise_business_error('rfq_closed'); END IF;

  IF v_uid <> v_request.owner_user_id AND v_uid <> v_invitation.recipient_user_id THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  v_counterparty := CASE WHEN v_uid = v_request.owner_user_id THEN v_invitation.recipient_user_id ELSE v_request.owner_user_id END;

  INSERT INTO public.quote_responses (invitation_id, responder_user_id, parent_response_id, client_response_id, status, quoted_premium, notes)
  VALUES (v_invitation.id, v_uid, v_parent_response_id, v_client_response_id, 'countered', v_quoted_premium, v_notes)
  RETURNING id INTO v_response_id;

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_counterparty, v_request.id,
    'Counter quote proposed for ' || (v_request.terms->>'quantity') || ' ' || (v_request.terms->>'product') || ' at premium ' || v_quoted_premium
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation.id, 'parentResponseId', v_parent_response_id,
      'responderUserId', v_uid, 'createdAt', now(), 'status', 'countered',
      'quotedPremium', v_quoted_premium, 'notes', v_notes
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_counterparty,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id)
  VALUES (v_uid, v_client_response_id, 'counter', jsonb_build_object('parentResponseId', v_parent_response_id, 'quotedPremium', v_quoted_premium, 'notes', v_notes), v_result, v_message_id, v_response_id);

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_quote_response(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_response_id uuid;
  v_client_action_id uuid;
  v_canonical jsonb;
  v_idem public.quote_workflow_idempotency;
  v_idem_exists boolean;
  v_response public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_effective text;
  v_message_id uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  BEGIN
    v_response_id := (request->>'responseId')::uuid;
    v_client_action_id := (request->>'clientActionId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  v_canonical := jsonb_build_object('responseId', v_response_id);

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_client_action_id::text));

  SELECT EXISTS(
    SELECT 1 FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_action_id
  ) INTO v_idem_exists;
  IF v_idem_exists THEN
    SELECT * INTO v_idem FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_action_id;
    IF v_idem.canonical_request = v_canonical THEN
      RETURN v_idem.result_snapshot;
    END IF;
    PERFORM public.raise_business_error('idempotency_payload_mismatch');
  END IF;

  SELECT * INTO v_response FROM public.quote_responses WHERE id = v_response_id FOR UPDATE;
  IF v_response IS NULL THEN
    PERFORM public.raise_business_error('response_not_found');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_response.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;

  v_effective := public.effective_quote_status(v_request.id);
  IF v_effective = 'expired' THEN PERFORM public.raise_business_error('rfq_expired'); END IF;
  IF v_effective = 'converted' THEN PERFORM public.raise_business_error('rfq_closed'); END IF;

  IF v_uid <> v_request.owner_user_id THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  IF v_response.status NOT IN ('submitted', 'countered') THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;

  IF EXISTS (SELECT 1 FROM public.quote_response_decisions WHERE response_id = v_response_id) THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;

  INSERT INTO public.quote_response_decisions (response_id, decided_by_user_id, decision, client_action_id)
  VALUES (v_response_id, v_uid, 'rejected', v_client_action_id);

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_invitation.recipient_user_id, v_request.id,
    'Quote rejected for ' || (v_request.terms->>'quantity') || ' ' || (v_request.terms->>'product')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation.id, 'parentResponseId', v_response.parent_response_id,
      'responderUserId', v_response.responder_user_id, 'createdAt', v_response.created_at,
      'status', v_response.status, 'decision', 'rejected', 'quotedPremium', v_response.quoted_premium, 'notes', v_response.notes
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_invitation.recipient_user_id,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id)
  VALUES (v_uid, v_client_action_id, 'reject', v_canonical, v_result, v_message_id, v_response_id);

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_quote_response(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_response_id uuid;
  v_client_action_id uuid;
  v_canonical jsonb;
  v_idem public.quote_workflow_idempotency;
  v_idem_exists boolean;
  v_response public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_effective text;
  v_deal_id uuid;
  v_message_id uuid;
  v_snapshot jsonb;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  BEGIN
    v_response_id := (request->>'responseId')::uuid;
    v_client_action_id := (request->>'clientActionId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  v_canonical := jsonb_build_object('responseId', v_response_id);

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_client_action_id::text));

  SELECT EXISTS(
    SELECT 1 FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_action_id
  ) INTO v_idem_exists;
  IF v_idem_exists THEN
    SELECT * INTO v_idem FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_action_id;
    IF v_idem.canonical_request = v_canonical THEN
      RETURN v_idem.result_snapshot;
    END IF;
    PERFORM public.raise_business_error('idempotency_payload_mismatch');
  END IF;

  SELECT * INTO v_response FROM public.quote_responses WHERE id = v_response_id FOR UPDATE;
  IF v_response IS NULL THEN
    PERFORM public.raise_business_error('response_not_found');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_response.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;

  v_effective := public.effective_quote_status(v_request.id);
  IF v_effective = 'expired' THEN PERFORM public.raise_business_error('rfq_expired'); END IF;
  IF v_effective = 'converted' THEN PERFORM public.raise_business_error('rfq_closed'); END IF;

  IF v_uid <> v_request.owner_user_id THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  IF v_response.status NOT IN ('submitted', 'countered') THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;

  IF EXISTS (SELECT 1 FROM public.quote_response_decisions WHERE response_id = v_response_id) THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;

  IF v_response.responder_user_id <> v_invitation.recipient_user_id THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  IF EXISTS (SELECT 1 FROM public.trade_deals WHERE request_id = v_request.id) THEN
    PERFORM public.raise_business_error('deal_already_booked');
  END IF;

  v_snapshot := jsonb_build_object(
    'terms', v_request.terms,
    'selectedResponseId', v_response_id,
    'quotedPremium', v_response.quoted_premium,
    'responseNotes', v_response.notes
  );

  INSERT INTO public.trade_deals (request_id, response_id, counterparty_user_id, booked_by_user_id, booking_client_action_id, product, volume, status, commercial_terms_snapshot)
  VALUES (v_request.id, v_response_id, v_invitation.recipient_user_id, v_uid, v_client_action_id, v_request.terms->>'product', v_request.terms->>'quantity', 'booked', v_snapshot)
  RETURNING id INTO v_deal_id;

  INSERT INTO public.quote_response_decisions (response_id, decided_by_user_id, decision, client_action_id)
  VALUES (v_response_id, v_uid, 'accepted', v_client_action_id);

  UPDATE public.quote_requests SET status = 'converted' WHERE id = v_request.id;

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_invitation.recipient_user_id, v_request.id,
    'Deal booked for ' || (v_request.terms->>'quantity') || ' ' || (v_request.terms->>'product')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation.id, 'parentResponseId', v_response.parent_response_id,
      'responderUserId', v_response.responder_user_id, 'createdAt', v_response.created_at,
      'status', v_response.status, 'decision', 'accepted', 'quotedPremium', v_response.quoted_premium, 'notes', v_response.notes
    ),
    'deal', jsonb_build_object(
      'id', v_deal_id, 'requestId', v_request.id, 'responseId', v_response_id,
      'counterpartyUserId', v_invitation.recipient_user_id, 'bookedByUserId', v_uid,
      'product', v_request.terms->>'product', 'volume', v_request.terms->>'quantity',
      'createdAt', now(), 'status', 'booked', 'commercialTermsSnapshot', v_snapshot
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_invitation.recipient_user_id,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id, deal_id)
  VALUES (v_uid, v_client_action_id, 'book', v_canonical, v_result, v_message_id, v_response_id, v_deal_id);

  RETURN v_result;
END;
$$;
