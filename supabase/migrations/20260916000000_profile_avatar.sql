-- ============================================
-- Profile avatar persistence
-- ============================================

ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS "avatar_url" text;

-- Return the authenticated user's own profile (full_name, organization, avatar_url).
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'fullName', COALESCE(p."full_name", ''),
    'organization', COALESCE(p."organization", ''),
    'avatarUrl', COALESCE(p."avatar_url", '')
  )
  FROM public.profile p
  WHERE p."user_id" = (SELECT auth.uid());
$$;

-- Upsert the authenticated user's avatar_url.
CREATE OR REPLACE FUNCTION public.update_my_avatar("p_avatar_url" text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.profile ("user_id", "avatar_url")
  VALUES (v_user_id, "p_avatar_url")
  ON CONFLICT ("user_id")
  DO UPDATE SET "avatar_url" = EXCLUDED."avatar_url";
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_avatar(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_avatar(text) FROM PUBLIC, anon;
