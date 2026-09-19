-- ============================================
-- Observability, health and reconciliation (Phase 14)
-- ============================================

CREATE OR REPLACE FUNCTION public.health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending_outbox int;
  v_stuck_jobs int;
BEGIN
  IF auth.uid() IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;

  SELECT count(*) INTO v_pending_outbox FROM public.domain_outbox WHERE status = 'pending';
  SELECT count(*) INTO v_stuck_jobs
  FROM public.document_generation_jobs
  WHERE status = 'running' AND updated_at < now() - interval '15 minutes';

  RETURN jsonb_build_object(
    'ok', true,
    'database', true,
    'pendingOutbox', v_pending_outbox,
    'stuckDocumentJobs', v_stuck_jobs
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_rfq_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;

  SELECT COALESCE(
    jsonb_agg(q.id),
    '[]'::jsonb
  ) INTO v_result
  FROM public.quote_requests q
  WHERE q.status = 'open'
    AND EXISTS (SELECT 1 FROM public.trade_deals d WHERE d.request_id = q.id);

  RETURN jsonb_build_object('inconsistentRfqIds', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_deal_decision()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;

  SELECT COALESCE(
    jsonb_agg(d.id),
    '[]'::jsonb
  ) INTO v_result
  FROM public.trade_deals d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.quote_response_decisions r
    WHERE r.response_id = d.response_id AND r.decision = 'accepted'
  );

  RETURN jsonb_build_object('dealsWithoutDecision', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_document_metadata()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;

  SELECT COALESCE(
    jsonb_agg(d.id),
    '[]'::jsonb
  ) INTO v_result
  FROM public.documents d
  WHERE d.status = 'generated'
    AND NOT EXISTS (SELECT 1 FROM public.document_versions v WHERE v.document_id = d.id);

  RETURN jsonb_build_object('documentsWithoutVersion', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.health_check() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_rfq_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_rfq_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_deal_decision() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_deal_decision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_document_metadata() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_document_metadata() FROM PUBLIC, anon;
