-- ============================================
-- Review fix H-6, H-7: admin role dedup and CSV counterparty validation.
-- ============================================

-- H-6: avoid duplicate active role assignments.
CREATE OR REPLACE FUNCTION public.admin_assign_user_role(
  p_user_id uuid,
  p_role_code text,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;
  IF NOT public.is_platform_admin()
     AND NOT public.has_entitlement_for_org('ORG_MEMBERS_MANAGE', p_organization_id) THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    PERFORM public.raise_business_error('user_not_found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_roles r WHERE r.code = p_role_code) THEN
    PERFORM public.raise_business_error('invalid_role_code');
  END IF;
  IF p_organization_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id) THEN
    PERFORM public.raise_business_error('organization_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = p_user_id AND role_code = p_role_code
      AND (organization_id IS NOT DISTINCT FROM p_organization_id)
      AND (valid_until IS NULL OR valid_until > now())
  ) THEN
    RETURN jsonb_build_object('ok', true, 'userId', p_user_id, 'roleCode', p_role_code, 'organizationId', p_organization_id, 'alreadyAssigned', true);
  END IF;

  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES (p_user_id, p_role_code, p_organization_id, now());

  RETURN jsonb_build_object('ok', true, 'userId', p_user_id, 'roleCode', p_role_code, 'organizationId', p_organization_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_user_role(uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_assign_user_role(uuid, text, uuid) FROM PUBLIC, anon;

-- H-7: validate the counterparty organization id during CSV staging.
CREATE OR REPLACE FUNCTION public.create_trade_volume_import_batch(
  p_file_name text,
  p_file_hash text,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_batch_id uuid;
  v_row jsonb;
  v_row_number int := 0;
  v_valid int := 0;
  v_invalid int := 0;
  v_status text;
  v_hash text;
  v_error text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;
  IF v_org_id IS NULL THEN PERFORM public.raise_business_error('no_active_organization'); END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  INSERT INTO public.trade_volume_import_batches (organization_id, status, file_name, file_hash, created_by_user_id)
  VALUES (v_org_id, 'uploaded', p_file_name, p_file_hash, v_uid)
  RETURNING id INTO v_batch_id;

  FOR v_row IN SELECT jsonb_array_elements(p_rows) LOOP
    v_row_number := v_row_number + 1;
    v_error := NULL;

    IF (v_row->>'tradeDate') IS NULL OR (v_row->>'tradeDate')::timestamptz IS NULL THEN
      v_error := 'invalid_date';
    ELSIF (v_row->>'primaryMetal') NOT IN ('AU','AG','PT','PD','OTHER') THEN
      v_error := 'invalid_metal';
    ELSIF (v_row->>'quantity') IS NULL OR (v_row->>'quantity') !~ '^\d+(\.\d+)?$' THEN
      v_error := 'invalid_quantity';
    ELSIF (v_row->>'quantityUnit') NOT IN ('KG','G','TOZ','MT','PCS') THEN
      v_error := 'invalid_unit';
    ELSIF (v_row->>'counterpartyOrganizationId') IS NOT NULL
           AND (v_row->>'counterpartyOrganizationId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_error := 'invalid_counterparty';
    END IF;

    v_hash := md5(coalesce(v_row::text, ''));

    IF v_error IS NULL THEN
      v_valid := v_valid + 1;
      v_status := 'valid';
    ELSE
      v_invalid := v_invalid + 1;
      v_status := 'invalid';
    END IF;

    INSERT INTO public.trade_volume_import_rows (batch_id, row_number, status, row_hash, error_code, raw_data, entry_data)
    VALUES (v_batch_id, v_row_number, v_status, v_hash, v_error, v_row,
            CASE WHEN v_error IS NULL THEN v_row ELSE NULL END);
  END LOOP;

  v_status := CASE WHEN v_invalid = 0 THEN 'ready' ELSE 'validation_failed' END;
  UPDATE public.trade_volume_import_batches SET status = v_status, updated_at = now() WHERE id = v_batch_id;

  RETURN jsonb_build_object('ok', true, 'batchId', v_batch_id, 'valid', v_valid, 'invalid', v_invalid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_trade_volume_import_batch(text, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_trade_volume_import_batch(text, text, jsonb) FROM PUBLIC, anon;
