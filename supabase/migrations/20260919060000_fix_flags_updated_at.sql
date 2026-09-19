-- ============================================
-- Review fix M-10, L-5: client-visible feature flags and quote_responses
-- updated_at trigger.
-- ============================================

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT true;

-- M-10: only return client-visible flags to the browser.
CREATE OR REPLACE FUNCTION public.get_my_trading_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_membership jsonb;
  v_org_id uuid;
  v_capabilities jsonb;
  v_entitlements jsonb;
  v_flags jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'userId', NULL,
      'membership', NULL,
      'capabilities', '[]'::jsonb,
      'entitlements', '[]'::jsonb,
      'flags', '{}'::jsonb
    );
  END IF;

  v_membership := public.current_organization_membership();
  v_org_id := (v_membership->>'organizationId')::uuid;

  SELECT COALESCE(
    jsonb_agg(oc.capability_code ORDER BY oc.capability_code),
    '[]'::jsonb
  ) INTO v_capabilities
  FROM public.organization_capabilities oc
  WHERE oc.organization_id = v_org_id
    AND oc.status = 'active'
    AND (oc.valid_until IS NULL OR oc.valid_until > now());

  SELECT COALESCE(
    jsonb_agg(DISTINCT pre.entitlement_code ORDER BY pre.entitlement_code),
    '[]'::jsonb
  ) INTO v_entitlements
  FROM public.user_platform_roles upr
  JOIN public.platform_role_entitlements pre ON pre.role_code = upr.role_code
  WHERE upr.user_id = v_uid
    AND (upr.valid_until IS NULL OR upr.valid_until > now())
    AND (upr.organization_id IS NULL OR upr.organization_id = v_org_id);

  SELECT COALESCE(
    jsonb_object_agg(ff.key, ff.enabled),
    '{}'::jsonb
  ) INTO v_flags
  FROM public.feature_flags ff
  WHERE ff.client_visible = true;

  RETURN jsonb_build_object(
    'userId', v_uid,
    'membership', v_membership,
    'capabilities', v_capabilities,
    'entitlements', v_entitlements,
    'flags', v_flags
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_trading_context() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_trading_context() FROM PUBLIC, anon;

-- L-5: quote_responses updated_at for status-transition auditability.
ALTER TABLE public.quote_responses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER update_quote_responses_updated_at
  BEFORE UPDATE ON public.quote_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
