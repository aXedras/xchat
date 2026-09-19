-- ============================================
-- Review fix H-3, M-4, M-5: RFQ dispatch idempotency hash comparison,
-- drop unnecessary request lock on mark-viewed, guard cancel invitations.
-- ============================================

CREATE OR REPLACE FUNCTION public.create_and_dispatch_quote_request_v2(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_dispatch_id uuid;
  v_transaction_type text;
  v_terms jsonb;
  v_message_content text;
  v_recipient_ids uuid[] := ARRAY[]::uuid[];
  v_recipient_raw text;
  v_recipient_id uuid;
  v_request_id uuid;
  v_public_reference text;
  v_conversation_id uuid;
  v_message_id uuid;
  v_recipient_org uuid;
  v_is_retry boolean;
  v_dispatch_sender uuid;
  v_dispatch_rfq_id uuid;
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
    v_dispatch_id := (request->>'clientOperationId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  v_transaction_type := request->>'transactionType';
  v_terms := request->'terms';

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

  IF NOT public.has_entitlement('RFQ_CREATE') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;
  IF v_org_id IS NULL THEN
    PERFORM public.raise_business_error('no_active_organization');
  END IF;

  v_terms := public.normalize_rfq_terms_v2(v_terms, v_transaction_type);

  v_message_content := trim(COALESCE(request->>'message', ''));
  IF char_length(v_message_content) > 10000 THEN
    PERFORM public.raise_business_error('invalid_request');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rfqv2:' || v_dispatch_id::text));

  SELECT sender_user_id, quote_request_id
    INTO v_dispatch_sender, v_dispatch_rfq_id
  FROM public.message_dispatch WHERE id = v_dispatch_id;
  v_is_retry := v_dispatch_sender IS NOT NULL;

  IF v_is_retry THEN
    IF v_dispatch_sender <> v_uid THEN
      PERFORM public.raise_business_error('dispatch_owned_by_other_user');
    END IF;
    v_request_id := v_dispatch_rfq_id;
    IF v_request_id IS NULL THEN
      PERFORM public.raise_business_error('dispatch_payload_mismatch');
    END IF;

    -- H-3: reject a replay carrying a different payload; compare canonical
    -- hashes so semantically identical JSON (any key order) matches.
    IF EXISTS (
      SELECT 1 FROM public.quote_requests q
      WHERE q.id = v_request_id
        AND (q.transaction_type IS DISTINCT FROM v_transaction_type
             OR md5(q.terms::text) IS DISTINCT FROM md5(v_terms::text))
    ) THEN
      PERFORM public.raise_business_error('idempotency_payload_mismatch');
    END IF;
  ELSE
    LOOP
      v_public_reference := 'RFQ-' || upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.quote_requests WHERE public_reference = v_public_reference);
    END LOOP;

    INSERT INTO public.quote_requests (
      owner_user_id, requester_organization_id, transaction_type, schema_version,
      public_reference, terms, status, response_deadline
    )
    VALUES (
      v_uid, v_org_id, v_transaction_type, 1, v_public_reference, v_terms, 'open',
      (v_terms->'commercial'->>'responseDeadline')::timestamptz
    )
    RETURNING id INTO v_request_id;

    INSERT INTO public.message_dispatch (id, sender_user_id, message_type, content, quote_request_id, status)
    VALUES (v_dispatch_id, v_uid, 'rfq', v_message_content, v_request_id, 'failed')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.quote_request_events (request_id, actor_user_id, actor_organization_id, event_type, event_payload, correlation_id)
    VALUES (v_request_id, v_uid, v_org_id, 'rfq_created', jsonb_build_object('transactionType', v_transaction_type, 'publicReference', v_public_reference), v_dispatch_id);
  END IF;

  IF v_is_retry THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'recipientUserId', m.recipient_user_id,
          'message', jsonb_build_object(
            'id', m.id, 'conversationId', m.conversation_id,
            'senderUserId', m.sender_user_id, 'recipientUserId', m.recipient_user_id,
            'type', m.type, 'content', m.content, 'createdAt', m.created_at,
            'quoteRequestId', m.quote_request_id
          )
        )
        ORDER BY m.created_at ASC, m.id ASC
      ),
      '[]'::jsonb
    ) INTO v_messages
    FROM public.messages m
    WHERE m.id IN (
      SELECT r.message_id FROM public.message_dispatch_recipient r
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

      SELECT m.organization_id INTO v_recipient_org
      FROM public.organization_memberships m
      JOIN public.organizations o ON o.id = m.organization_id AND o.status = 'active'
      WHERE m.user_id = v_recipient_id
        AND m.status = 'active'
        AND (m.valid_until IS NULL OR m.valid_until > now())
      LIMIT 1;

      IF v_recipient_org IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.organization_capabilities c
        WHERE c.organization_id = v_recipient_org
          AND c.status = 'active'
          AND (c.valid_until IS NULL OR c.valid_until > now())
      ) THEN
        INSERT INTO public.message_dispatch_recipient (dispatch_id, requested_recipient_user_id, status, error_code)
        VALUES (v_dispatch_id, v_recipient_id, 'rejected', 'recipient_organization_ineligible')
        ON CONFLICT (dispatch_id, requested_recipient_user_id) DO NOTHING;
        CONTINUE;
      END IF;

      v_conversation_id := public.resolve_bilateral_conversation(v_uid, v_recipient_id);

      INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, type, content, quote_request_id)
      VALUES (v_conversation_id, v_uid, v_recipient_id, 'rfq', v_message_content, v_request_id)
      RETURNING id INTO v_message_id;

      INSERT INTO public.quote_request_invitations (
        request_id, recipient_user_id, recipient_organization_id, conversation_id,
        message_id, status, delivered_at
      )
      VALUES (v_request_id, v_recipient_id, v_recipient_org, v_conversation_id, v_message_id, 'delivered', now());

      INSERT INTO public.message_dispatch_recipient (dispatch_id, requested_recipient_user_id, recipient_user_id, status, message_id)
      VALUES (v_dispatch_id, v_recipient_id, v_recipient_id, 'accepted', v_message_id);

      v_messages := v_messages || jsonb_build_object(
        'recipientUserId', v_recipient_id,
        'message', jsonb_build_object(
          'id', v_message_id, 'conversationId', v_conversation_id,
          'senderUserId', v_uid, 'recipientUserId', v_recipient_id,
          'type', 'rfq', 'content', v_message_content, 'createdAt', now(),
          'quoteRequestId', v_request_id
        )
      );

      BEGIN
        PERFORM realtime.send(
          jsonb_build_object('messageId', v_message_id, 'conversationId', v_conversation_id, 'messageType', 'rfq'),
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
    'quoteRequestId', v_request_id,
    'dispatch', jsonb_build_object(
      'id', v_dispatch_id,
      'status', v_status,
      'messages', v_messages,
      'recipients', v_recipient_results
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_and_dispatch_quote_request_v2(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_and_dispatch_quote_request_v2(jsonb) FROM PUBLIC, anon;

-- M-4: drop the unnecessary request row lock (only the invitation is mutated).
CREATE OR REPLACE FUNCTION public.mark_quote_invitation_viewed(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_invitation public.quote_request_invitations;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM public.quote_request_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF v_invitation IS NULL OR v_invitation.recipient_user_id <> v_uid THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  -- first_viewed_at is write-once; last_viewed_at is monotonic.
  IF v_invitation.first_viewed_at IS NULL THEN
    UPDATE public.quote_request_invitations
    SET first_viewed_at = now(), last_viewed_at = now(), status = 'viewed'
    WHERE id = p_invitation_id;
    INSERT INTO public.quote_request_events (request_id, invitation_id, actor_user_id, actor_organization_id, event_type)
    VALUES (v_invitation.request_id, p_invitation_id, v_uid, v_invitation.recipient_organization_id, 'invitation_viewed');
  ELSE
    UPDATE public.quote_request_invitations
    SET last_viewed_at = now()
    WHERE id = p_invitation_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'invitationId', p_invitation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_quote_invitation_viewed(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_quote_invitation_viewed(uuid) FROM PUBLIC, anon;

-- M-5: guard the invitation close so a concurrently responded/declined
-- invitation is not overwritten.
CREATE OR REPLACE FUNCTION public.cancel_quote_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_request public.quote_requests;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  SELECT * INTO v_request FROM public.quote_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request IS NULL OR v_request.owner_user_id <> v_uid THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF v_request.status NOT IN ('open') THEN
    PERFORM public.raise_business_error('invalid_rfq_state');
  END IF;

  UPDATE public.quote_requests
  SET status = 'cancelled', closed_at = now(), close_reason = 'cancelled', updated_at = now()
  WHERE id = p_request_id;

  UPDATE public.quote_request_invitations
  SET status = 'closed', closed_at = now(), close_reason = 'cancelled'
  WHERE request_id = p_request_id
    AND status NOT IN ('responded', 'declined', 'closed');

  INSERT INTO public.quote_request_events (request_id, actor_user_id, actor_organization_id, event_type)
  VALUES (p_request_id, v_uid, v_request.requester_organization_id, 'rfq_cancelled');

  RETURN jsonb_build_object('ok', true, 'requestId', p_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_quote_request(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_quote_request(uuid) FROM PUBLIC, anon;
