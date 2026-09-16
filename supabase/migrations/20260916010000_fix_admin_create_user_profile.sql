-- ============================================
-- Fix: admin_create_user referenced public.profiles (plural).
-- The profile table is public.profile.
-- ============================================

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
  INSERT INTO public.profile ("user_id", "full_name", "organization")
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
