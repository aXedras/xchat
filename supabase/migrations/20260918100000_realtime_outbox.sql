-- ============================================
-- Realtime, outbox and delivery reliability (Phase 12)
-- ============================================

-- Persisted domain events are the source of truth for delivery. Realtime is a
-- best-effort notification; clients reconcile via the catch-up projection.
CREATE TABLE IF NOT EXISTS public.domain_outbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  event_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_outbox_status_check CHECK (
    status IN ('pending', 'claimed', 'delivered', 'dead_letter')
  ),
  CONSTRAINT domain_outbox_event_unique UNIQUE (event_id, recipient_user_id)
);
ALTER TABLE public.domain_outbox OWNER TO postgres;

CREATE INDEX IF NOT EXISTS domain_outbox_pending_idx
  ON public.domain_outbox (status, created_at);

-- The topic is always derived server-side from the recipient user id; clients
-- never supply a realtime topic.
CREATE OR REPLACE FUNCTION public.domain_outbox_topic(p_recipient_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 'user:' || p_recipient_user_id::text;
$$;

-- ============================================
-- Catch-up projection (reconnect reconciliation)
-- ============================================

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
        LIMIT p_limit
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

-- ============================================
-- RLS and grants
-- ============================================

ALTER TABLE public.domain_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.domain_outbox FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_trading_events_since(timestamptz, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_trading_events_since(timestamptz, integer) FROM PUBLIC, anon;

-- The outbox is consumed by the worker under service role; the claim RPC is
-- service-role only.
CREATE OR REPLACE FUNCTION public.claim_outbox_batch(p_batch_size integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  WITH claimed AS (
    SELECT id FROM public.domain_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.domain_outbox o
  SET status = 'claimed', attempts = attempts + 1, updated_at = now()
  FROM claimed
  WHERE o.id = claimed.id;

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
  WHERE o.status = 'claimed' AND o.attempts = 1;

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_outbox_batch(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_batch(integer) FROM PUBLIC, anon, authenticated;
