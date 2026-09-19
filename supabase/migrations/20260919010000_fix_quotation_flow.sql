-- ============================================
-- Review fix C-1, M-2, H-5: quotation flow entitlement checks, events,
-- pricing component helper and response status transitions.
-- ============================================

-- H-5: extend the response status machine to accepted/rejected/expired.
ALTER TABLE public.quote_responses
  DROP CONSTRAINT IF EXISTS quote_responses_status_check;
ALTER TABLE public.quote_responses
  ADD CONSTRAINT quote_responses_status_check CHECK (
    status IN ('submitted', 'countered', 'superseded', 'withdrawn', 'accepted', 'rejected', 'expired')
  );

-- M-2: shared pricing component insert helper (DRY).
CREATE OR REPLACE FUNCTION public.insert_pricing_components(p_response_id uuid, p_terms jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_component jsonb;
  v_seq int := 0;
BEGIN
  FOR v_component IN SELECT jsonb_array_elements(p_terms->'pricingComponents') LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.quote_pricing_components (
      response_id, sequence_no, component_type, label, calculation_method,
      numeric_value, formula_text, currency_code, unit_code, charge_direction,
      tax_treatment, minimum_amount, maximum_amount, notes
    )
    VALUES (
      p_response_id, v_seq,
      v_component->>'componentType', v_component->>'label', v_component->>'calculationMethod',
      NULLIF(v_component->>'numericValue','')::numeric, NULLIF(v_component->>'formulaText',''),
      NULLIF(v_component->>'currencyCode',''), NULLIF(v_component->>'unitCode',''),
      v_component->>'chargeDirection', v_component->>'taxTreatment',
      NULLIF(v_component->>'minimumAmount','')::numeric, NULLIF(v_component->>'maximumAmount','')::numeric,
      NULLIF(v_component->>'notes','')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_pricing_components(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ============================================
-- submit_quote_response_v2 (C-1 + M-2 + events)
-- ============================================

CREATE OR REPLACE FUNCTION public.submit_quote_response_v2(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_invitation_id uuid;
  v_client_response_id uuid;
  v_terms jsonb;
  v_canonical jsonb;
  v_idem public.quote_workflow_idempotency;
  v_idem_exists boolean;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_effective text;
  v_response_id uuid;
  v_message_id uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF NOT public.has_entitlement('RFQ_RESPOND') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  BEGIN
    v_invitation_id := (request->>'invitationId')::uuid;
    v_client_response_id := (request->>'clientResponseId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  v_terms := public.normalize_quote_response_v2(request->'responseTerms');
  v_canonical := jsonb_build_object('invitationId', v_invitation_id, 'responseTerms', v_terms);

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_client_response_id::text));

  SELECT EXISTS(
    SELECT 1 FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id
  ) INTO v_idem_exists;
  IF v_idem_exists THEN
    SELECT * INTO v_idem FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id;
    IF v_idem.canonical_request = v_canonical THEN RETURN v_idem.result_snapshot; END IF;
    PERFORM public.raise_business_error('idempotency_payload_mismatch');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_invitation_id;
  IF v_invitation IS NULL THEN PERFORM public.raise_business_error('invitation_not_found'); END IF;

  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;
  v_effective := public.effective_quote_status(v_request.id);
  IF v_effective = 'expired' THEN PERFORM public.raise_business_error('rfq_expired'); END IF;
  IF v_effective = 'converted' THEN PERFORM public.raise_business_error('rfq_closed'); END IF;

  IF v_invitation.recipient_user_id <> v_uid THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;

  INSERT INTO public.quote_responses (
    invitation_id, responder_user_id, responder_organization_id, parent_response_id,
    client_response_id, status, schema_version, response_terms, valid_until
  )
  VALUES (
    v_invitation_id, v_uid, v_org_id, NULL, v_client_response_id,
    'submitted', 1, v_terms, (v_terms->'commercial'->>'validUntil')::timestamptz
  )
  RETURNING id INTO v_response_id;

  PERFORM public.insert_pricing_components(v_response_id, v_terms);

  UPDATE public.quote_request_invitations
  SET status = 'responded', responded_at = now()
  WHERE id = v_invitation_id;

  INSERT INTO public.quote_request_events (request_id, invitation_id, actor_user_id, actor_organization_id, event_type)
  VALUES (v_request.id, v_invitation_id, v_uid, v_org_id, 'quotation_submitted');

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_request.owner_user_id, v_request.id,
    'Quotation submitted for ' || COALESCE(v_request.public_reference, 'RFQ')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation_id, 'parentResponseId', NULL,
      'responderUserId', v_uid, 'createdAt', now(), 'status', 'submitted',
      'schemaVersion', 1, 'responseTerms', v_terms
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_request.owner_user_id,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id)
  VALUES (v_uid, v_client_response_id, 'submit', v_canonical, v_result, v_message_id, v_response_id);

  RETURN v_result;
END;
$$;

-- ============================================
-- counter_quote_response_v2 (C-1 + M-2 + events)
-- ============================================

CREATE OR REPLACE FUNCTION public.counter_quote_response_v2(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_parent_response_id uuid;
  v_client_response_id uuid;
  v_terms jsonb;
  v_canonical jsonb;
  v_idem public.quote_workflow_idempotency;
  v_idem_exists boolean;
  v_parent public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_effective text;
  v_counterparty uuid;
  v_response_id uuid;
  v_message_id uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF NOT public.has_entitlement('RFQ_COUNTER') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  BEGIN
    v_parent_response_id := (request->>'parentResponseId')::uuid;
    v_client_response_id := (request->>'clientResponseId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  v_terms := public.normalize_quote_response_v2(request->'responseTerms');
  v_canonical := jsonb_build_object('parentResponseId', v_parent_response_id, 'responseTerms', v_terms);

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_client_response_id::text));

  SELECT EXISTS(
    SELECT 1 FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id
  ) INTO v_idem_exists;
  IF v_idem_exists THEN
    SELECT * INTO v_idem FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_response_id;
    IF v_idem.canonical_request = v_canonical THEN RETURN v_idem.result_snapshot; END IF;
    PERFORM public.raise_business_error('idempotency_payload_mismatch');
  END IF;

  SELECT * INTO v_parent FROM public.quote_responses WHERE id = v_parent_response_id FOR UPDATE;
  IF v_parent IS NULL THEN PERFORM public.raise_business_error('response_not_found'); END IF;
  IF v_parent.status NOT IN ('submitted', 'countered') THEN
    PERFORM public.raise_business_error('invalid_parent_response');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_parent.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;

  v_effective := public.effective_quote_status(v_request.id);
  IF v_effective = 'expired' THEN PERFORM public.raise_business_error('rfq_expired'); END IF;
  IF v_effective = 'converted' THEN PERFORM public.raise_business_error('rfq_closed'); END IF;

  IF v_uid <> v_request.owner_user_id AND v_uid <> v_invitation.recipient_user_id THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;
  v_counterparty := CASE WHEN v_uid = v_request.owner_user_id THEN v_invitation.recipient_user_id ELSE v_request.owner_user_id END;

  INSERT INTO public.quote_responses (
    invitation_id, responder_user_id, responder_organization_id, parent_response_id,
    client_response_id, status, schema_version, response_terms, valid_until
  )
  VALUES (
    v_invitation.id, v_uid, v_org_id, v_parent_response_id, v_client_response_id,
    'countered', 1, v_terms, (v_terms->'commercial'->>'validUntil')::timestamptz
  )
  RETURNING id INTO v_response_id;

  PERFORM public.insert_pricing_components(v_response_id, v_terms);

  UPDATE public.quote_responses SET status = 'superseded' WHERE id = v_parent_response_id AND status <> 'superseded';

  INSERT INTO public.quote_request_events (request_id, invitation_id, actor_user_id, actor_organization_id, event_type)
  VALUES (v_request.id, v_invitation.id, v_uid, v_org_id, 'quotation_countered');

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_counterparty, v_request.id,
    'Counter offer proposed for ' || COALESCE(v_request.public_reference, 'RFQ')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation.id, 'parentResponseId', v_parent_response_id,
      'responderUserId', v_uid, 'createdAt', now(), 'status', 'countered',
      'schemaVersion', 1, 'responseTerms', v_terms
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_counterparty,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id)
  VALUES (v_uid, v_client_response_id, 'counter', v_canonical, v_result, v_message_id, v_response_id);

  RETURN v_result;
END;
$$;

-- ============================================
-- withdraw_quote_response (C-1)
-- ============================================

CREATE OR REPLACE FUNCTION public.withdraw_quote_response(p_response_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_response public.quote_responses;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF NOT public.has_entitlement('RFQ_RESPOND') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  SELECT * INTO v_response FROM public.quote_responses WHERE id = p_response_id FOR UPDATE;
  IF v_response IS NULL THEN PERFORM public.raise_business_error('response_not_found'); END IF;
  IF v_response.responder_user_id <> v_uid THEN PERFORM public.raise_business_error('not_authorized'); END IF;
  IF v_response.status NOT IN ('submitted', 'countered') THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;

  UPDATE public.quote_responses SET status = 'withdrawn' WHERE id = p_response_id;
  RETURN jsonb_build_object('ok', true, 'responseId', p_response_id);
END;
$$;

-- ============================================
-- decline_quote_invitation (C-1)
-- ============================================

CREATE OR REPLACE FUNCTION public.decline_quote_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF NOT public.has_entitlement('RFQ_RESPOND') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_invitation IS NULL OR v_invitation.recipient_user_id <> v_uid THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;
  IF public.effective_quote_status(v_request.id) = 'converted' THEN
    PERFORM public.raise_business_error('rfq_closed');
  END IF;

  UPDATE public.quote_request_invitations SET status = 'declined', closed_at = now(), close_reason = 'declined'
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('ok', true, 'invitationId', p_invitation_id);
END;
$$;

-- ============================================
-- reject_quote_response_v2 (H-5 + events)
-- ============================================

CREATE OR REPLACE FUNCTION public.reject_quote_response_v2(request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_response_id uuid;
  v_client_action_id uuid;
  v_canonical jsonb;
  v_idem public.quote_workflow_idempotency;
  v_idem_exists boolean;
  v_response public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_message_id uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF request IS NULL OR jsonb_typeof(request) <> 'object' THEN PERFORM public.raise_business_error('invalid_request'); END IF;

  BEGIN
    v_response_id := (request->>'responseId')::uuid;
    v_client_action_id := (request->>'clientActionId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_request');
  END;

  v_canonical := jsonb_build_object('responseId', v_response_id);

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_client_action_id::text));

  SELECT EXISTS(
    SELECT 1 FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_action_id
  ) INTO v_idem_exists;
  IF v_idem_exists THEN
    SELECT * INTO v_idem FROM public.quote_workflow_idempotency
    WHERE actor_user_id = v_uid AND client_operation_id = v_client_action_id;
    IF v_idem.canonical_request = v_canonical THEN RETURN v_idem.result_snapshot; END IF;
    PERFORM public.raise_business_error('idempotency_payload_mismatch');
  END IF;

  SELECT * INTO v_response FROM public.quote_responses WHERE id = v_response_id FOR UPDATE;
  IF v_response IS NULL THEN PERFORM public.raise_business_error('response_not_found'); END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_response.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;

  IF v_uid <> v_request.owner_user_id THEN PERFORM public.raise_business_error('not_authorized'); END IF;
  IF v_response.status NOT IN ('submitted', 'countered') THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;
  IF EXISTS (SELECT 1 FROM public.quote_response_decisions WHERE response_id = v_response_id) THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;

  INSERT INTO public.quote_response_decisions (response_id, decided_by_user_id, decision, client_action_id)
  VALUES (v_response_id, v_uid, 'rejected', v_client_action_id);

  UPDATE public.quote_responses SET status = 'rejected' WHERE id = v_response_id;

  INSERT INTO public.quote_request_events (request_id, invitation_id, actor_user_id, actor_organization_id, event_type)
  VALUES (v_request.id, v_invitation.id, v_uid, v_request.requester_organization_id, 'quotation_rejected');

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_invitation.recipient_user_id, v_request.id,
    'Quote rejected for ' || COALESCE(v_request.public_reference, 'RFQ')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation.id, 'parentResponseId', v_response.parent_response_id,
      'responderUserId', v_response.responder_user_id, 'createdAt', v_response.created_at,
      'status', 'rejected', 'decision', 'rejected', 'schemaVersion', v_response.schema_version
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_invitation.recipient_user_id,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id)
  VALUES (v_uid, v_client_action_id, 'reject', v_canonical, v_result, v_message_id, v_response_id);

  RETURN v_result;
END;
$$;

-- ============================================
-- Grants
-- ============================================

GRANT EXECUTE ON FUNCTION public.submit_quote_response_v2(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_quote_response_v2(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.counter_quote_response_v2(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.counter_quote_response_v2(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_quote_response(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_quote_response(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_quote_invitation(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.decline_quote_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_quote_response_v2(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_quote_response_v2(jsonb) FROM PUBLIC, anon;
