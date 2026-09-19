-- ============================================
-- Review fix C-2, C-4, C-5, M-3: outbox claim correctness, operations
-- authorization and catch-up LIMIT placement.
-- ============================================

-- C-2: claim the batch and return exactly the claimed rows (retried rows
-- included) via a tracked id list.
CREATE OR REPLACE FUNCTION public.claim_outbox_batch(p_batch_size integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows jsonb;
  v_claimed_ids uuid[];
BEGIN
  WITH to_claim AS (
    SELECT id FROM public.domain_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.domain_outbox o
    SET status = 'claimed', attempts = attempts + 1, updated_at = now()
    FROM to_claim
    WHERE o.id = to_claim.id
    RETURNING o.id
  )
  SELECT array_agg(id) INTO v_claimed_ids FROM claimed;

  IF v_claimed_ids IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'eventType', o.event_type,
        'eventId', o.event_id,
        'payload', o.payload,
        'recipientUserId', o.recipient_user_id,
        'topic', public.domain_outbox_topic(o.recipient_user_id)
      )
      ORDER BY o.created_at
    ),
    '[]'::jsonb
  ) INTO v_rows
  FROM public.domain_outbox o
  WHERE o.id = ANY(v_claimed_ids);

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_outbox_batch(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_batch(integer) FROM PUBLIC, anon, authenticated;

-- M-3: move LIMIT to the outer query so all three union branches are bounded.
CREATE OR REPLACE FUNCTION public.list_trading_events_since(p_since timestamptz, p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(obj ORDER BY (obj->>'createdAt') ASC, (obj->>'id') ASC)
      FROM (
        SELECT obj
        FROM (
          SELECT jsonb_build_object(
                   'kind', 'rfq',
                   'id', e.id::text,
                   'aggregateId', e.request_id,
                   'eventType', e.event_type,
                   'correlationId', e.correlation_id,
                   'createdAt', e.created_at
                 ) AS obj
          FROM public.quote_request_events e
          JOIN public.quote_requests q ON q.id = e.request_id
          WHERE e.created_at > p_since
            AND (q.owner_user_id = v_uid
                 OR EXISTS (
                   SELECT 1 FROM public.quote_request_invitations i
                   WHERE i.request_id = q.id AND i.recipient_user_id = v_uid
                 ))
          UNION ALL
          SELECT jsonb_build_object(
                   'kind', 'deal',
                   'id', e.id::text,
                   'aggregateId', e.deal_id,
                   'eventType', e.event_type,
                   'correlationId', e.correlation_id,
                   'createdAt', e.created_at
                 ) AS obj
          FROM public.deal_events e
          JOIN public.trade_deals d ON d.id = e.deal_id
          WHERE e.created_at > p_since
            AND (d.booked_by_user_id = v_uid OR d.counterparty_user_id = v_uid)
          UNION ALL
          SELECT jsonb_build_object(
                   'kind', 'document',
                   'id', e.id::text,
                   'aggregateId', e.document_id,
                   'eventType', e.event_type,
                   'correlationId', NULL,
                   'createdAt', e.created_at
                 ) AS obj
          FROM public.document_events e
          WHERE e.created_at > p_since
            AND public.has_document_grant(e.document_id, 'view')
        ) events
        LIMIT p_limit
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_trading_events_since(timestamptz, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_trading_events_since(timestamptz, integer) FROM PUBLIC, anon;

-- C-4 + C-5: operations RPCs restricted to platform admins.
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
  IF NOT public.is_platform_admin() THEN PERFORM public.raise_business_error('not_authorized'); END IF;

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
  IF NOT public.is_platform_admin() THEN PERFORM public.raise_business_error('not_authorized'); END IF;

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
  IF NOT public.is_platform_admin() THEN PERFORM public.raise_business_error('not_authorized'); END IF;

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
  IF NOT public.is_platform_admin() THEN PERFORM public.raise_business_error('not_authorized'); END IF;

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

CREATE OR REPLACE FUNCTION public.reconcile_trade_volume()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF NOT public.is_platform_admin() THEN PERFORM public.raise_business_error('not_authorized'); END IF;

  SELECT COALESCE(
    jsonb_agg(d.id),
    '[]'::jsonb
  ) INTO v_result
  FROM public.trade_deals d
  WHERE d.commercial_terms_snapshot->'requestTerms'->'material' IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.trade_volume_entries e
      WHERE e.deal_id = d.id AND e.source_type = 'xchat_deal'
    );

  RETURN jsonb_build_object('missingDealIds', v_result);
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
GRANT EXECUTE ON FUNCTION public.reconcile_trade_volume() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_trade_volume() FROM PUBLIC, anon;
