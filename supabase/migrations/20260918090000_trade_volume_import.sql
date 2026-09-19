-- ============================================
-- Trade volume CSV import (Phase 11, staged + idempotent commit)
-- ============================================

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

CREATE OR REPLACE FUNCTION public.commit_trade_volume_import_batch(
  p_batch_id uuid,
  p_client_action_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_batch public.trade_volume_import_batches;
  v_row public.trade_volume_import_rows;
  v_grams numeric;
  v_committed int := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;
  IF v_org_id IS NULL THEN PERFORM public.raise_business_error('no_active_organization'); END IF;

  SELECT * INTO v_batch FROM public.trade_volume_import_batches WHERE id = p_batch_id FOR UPDATE;
  IF v_batch IS NULL THEN PERFORM public.raise_business_error('batch_not_found'); END IF;
  IF v_batch.organization_id <> v_org_id THEN PERFORM public.raise_business_error('not_authorized'); END IF;
  IF v_batch.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'batchId', p_batch_id, 'committed', 0, 'replayed', true);
  END IF;
  IF v_batch.status NOT IN ('ready', 'validation_failed') THEN
    PERFORM public.raise_business_error('batch_not_ready');
  END IF;
  IF EXISTS (SELECT 1 FROM public.trade_volume_import_rows WHERE batch_id = p_batch_id AND status = 'invalid') THEN
    PERFORM public.raise_business_error('batch_has_invalid_rows');
  END IF;

  UPDATE public.trade_volume_import_batches SET status = 'committing', updated_at = now() WHERE id = p_batch_id;

  FOR v_row IN SELECT * FROM public.trade_volume_import_rows WHERE batch_id = p_batch_id AND status = 'valid' LOOP
    v_grams := CASE v_row.entry_data->>'quantityUnit'
      WHEN 'KG' THEN (v_row.entry_data->>'quantity')::numeric * 1000
      WHEN 'G' THEN (v_row.entry_data->>'quantity')::numeric
      WHEN 'TOZ' THEN (v_row.entry_data->>'quantity')::numeric * 31.1034768
      WHEN 'MT' THEN (v_row.entry_data->>'quantity')::numeric * 1000000
      ELSE NULL
    END;

    INSERT INTO public.trade_volume_entries (
      organization_id, counterparty_organization_id, source_type, source_reference,
      primary_metal, quantity, quantity_unit, normalized_grams, trade_date, created_by_user_id
    )
    VALUES (
      v_org_id, NULLIF(v_row.entry_data->>'counterpartyOrganizationId','')::uuid, 'csv_import',
      p_client_action_id::text, v_row.entry_data->>'primaryMetal', (v_row.entry_data->>'quantity')::numeric,
      v_row.entry_data->>'quantityUnit', v_grams, (v_row.entry_data->>'tradeDate')::timestamptz, v_uid
    );

    UPDATE public.trade_volume_import_rows SET status = 'committed' WHERE id = v_row.id;
    v_committed := v_committed + 1;
  END LOOP;

  UPDATE public.trade_volume_import_batches SET status = 'completed', updated_at = now() WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'batchId', p_batch_id, 'committed', v_committed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_trade_volume_import_batch(text, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_trade_volume_import_batch(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_trade_volume_import_batch(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.commit_trade_volume_import_batch(uuid, uuid) FROM PUBLIC, anon;
