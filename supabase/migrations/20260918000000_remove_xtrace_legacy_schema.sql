-- ============================================
-- Remove xTrace legacy schema from deployed databases.
--
-- The xTrace domain objects were removed from the base migrations, but any
-- database that already applied the old migrations still contains them. This
-- migration reconciles such databases with the cleaned-up schema. It is a
-- no-op on a freshly reset database (all statements are guarded with IF EXISTS).
-- ============================================

-- ---------------------------------------------------------------------------
-- 1. Drop xTrace functions (RPCs and trigger functions).
--    Order matters: functions whose signature references a custom type must
--    be dropped before that type.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_supply_analytics(uuid);
DROP FUNCTION IF EXISTS public.truncate_supply_tables();
DROP FUNCTION IF EXISTS public.get_customer_elements(uuid);
DROP FUNCTION IF EXISTS public.get_customer_supply_count(uuid);
DROP FUNCTION IF EXISTS public.get_supply_by_origin(uuid);
DROP FUNCTION IF EXISTS public.get_origins_for_customer(uuid);
DROP FUNCTION IF EXISTS public.delete_origin_id_mappings_batch(uuid[]);
DROP FUNCTION IF EXISTS public.get_elements_in_supply_data();
DROP FUNCTION IF EXISTS public.get_origins_by_ids(uuid[]);
DROP FUNCTION IF EXISTS public.update_origins_status(uuid[], public.origin_status);
DROP FUNCTION IF EXISTS public.get_supply_ids_with_active_origins(uuid[]);
DROP FUNCTION IF EXISTS public.delete_origins_cascade(uuid[]);
DROP FUNCTION IF EXISTS public.current_member_email();
DROP FUNCTION IF EXISTS public.check_models_settings_drift();
DROP FUNCTION IF EXISTS public.deactivate_other_models();

-- ---------------------------------------------------------------------------
-- 2. Drop xTrace views.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.supply_filter_view;
DROP VIEW IF EXISTS public.supply_origin_lookup;

-- ---------------------------------------------------------------------------
-- 3. Remove xTrace tables from the realtime publication (supply was added to
--    supabase_realtime in the old migration).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'supply'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.supply;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Drop xTrace tables (CASCADE removes their foreign keys and indexes).
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.prediction_results CASCADE;
DROP TABLE IF EXISTS public.auto_prediction_jobs CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.models CASCADE;
DROP TABLE IF EXISTS public.alert_logs CASCADE;
DROP TABLE IF EXISTS public.alert_condition_channels CASCADE;
DROP TABLE IF EXISTS public.alert_conditions CASCADE;
DROP TABLE IF EXISTS public.alert_channels CASCADE;
DROP TABLE IF EXISTS public.origin_id_mapping CASCADE;
DROP TABLE IF EXISTS public.customer_origins CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.supply_elements CASCADE;
DROP TABLE IF EXISTS public.measurement_units CASCADE;
DROP TABLE IF EXISTS public.measurement_status CASCADE;
DROP TABLE IF EXISTS public.supply CASCADE;
DROP TABLE IF EXISTS public.element_category_map CASCADE;
DROP TABLE IF EXISTS public.element_categories CASCADE;
DROP TABLE IF EXISTS public.elements CASCADE;
DROP TABLE IF EXISTS public.origins CASCADE;
DROP TABLE IF EXISTS public.country CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Drop xTrace custom types.
-- ---------------------------------------------------------------------------
DROP TYPE IF EXISTS public.origin_status;
DROP TYPE IF EXISTS public.alert_channel_type;
DROP TYPE IF EXISTS public.alert_priority;

-- ---------------------------------------------------------------------------
-- 6. Align the system_settings category constraint with the cleaned schema
--    (remove the xTrace-only 'neural_network' category). Skipped when legacy
--    rows still use that category, to avoid deleting data implicitly.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.system_settings WHERE category = 'neural_network'
  ) THEN
    ALTER TABLE public.system_settings
      DROP CONSTRAINT IF EXISTS system_settings_category_check;
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_category_check
      CHECK (category IN ('system', 'email', 'backup', 'security'));
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Re-apply hardened SECURITY DEFINER functions (fixed search_path). The
--    base migrations are cleaned for fresh databases; this keeps deployed
--    databases consistent.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_role("_user_id" uuid, "_role" public.app_role) RETURNS boolean
  LANGUAGE "sql" STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER
  LANGUAGE "plpgsql"
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE "plpgsql"
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  BEGIN
  INSERT INTO public.profile (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS BOOLEAN
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'vendor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
SET search_path = ''
AS $$
BEGIN
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
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can create users';
  END IF;

  IF p_role NOT IN ('vendor', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Invalid role: must be vendor, manager, or operator';
  END IF;

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
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    NOW(),
    p_phone,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'organization', p_organization),
    NOW(),
    NOW(),
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO public.profile ("user_id", "full_name", "organization")
  VALUES (v_user_id, p_full_name, p_organization);

  INSERT INTO public.user_roles ("user_id", "role")
  VALUES (v_user_id, p_role::public.app_role);

  RETURN v_user_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.admin_update_user(
  "p_user_id" uuid,
  "p_full_name" TEXT DEFAULT NULL,
  "p_role" TEXT DEFAULT NULL,
  "p_organization" TEXT DEFAULT NULL,
  "p_phone" TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can update users';
  END IF;

  IF p_full_name IS NOT NULL OR p_organization IS NOT NULL THEN
    UPDATE public.profile
    SET
      full_name = COALESCE(p_full_name, full_name),
      organization = COALESCE(p_organization, organization)
    WHERE user_id = p_user_id;
  END IF;

  IF p_role IS NOT NULL THEN
    IF p_role NOT IN ('vendor', 'manager', 'operator') THEN
      RAISE EXCEPTION 'Invalid role: must be vendor, manager, or operator';
    END IF;

    UPDATE public.user_roles
    SET role = p_role::public.app_role
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (p_user_id, p_role::public.app_role);
    END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION public.admin_reset_password(
  "p_user_id" uuid,
  "p_new_password" TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can reset passwords';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
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

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  "p_user_id" uuid
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_vendor() THEN
    RAISE EXCEPTION 'Unauthorized: Only vendors can delete users';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

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
