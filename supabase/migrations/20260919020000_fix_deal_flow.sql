-- ============================================
-- Review fix C-3, H-4, H-5, L-1: complete deal snapshot (party names),
-- correct volatility, mark response accepted, add deal_booked RFQ event.
-- ============================================

-- C-3 + H-4: snapshot with party legal/display names and user display names;
-- VOLATILE because it calls now().
CREATE OR REPLACE FUNCTION public.build_deal_snapshot(
  p_request public.quote_requests,
  p_response public.quote_responses,
  p_requester_org uuid,
  p_counterparty_org uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pricing jsonb;
  v_req_org public.organizations;
  v_cp_org public.organizations;
BEGIN
  SELECT * INTO v_req_org FROM public.organizations WHERE id = p_requester_org;
  SELECT * INTO v_cp_org FROM public.organizations WHERE id = p_counterparty_org;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'componentType', c.component_type,
        'label', c.label,
        'calculationMethod', c.calculation_method,
        'numericValue', c.numeric_value,
        'formulaText', c.formula_text,
        'currencyCode', c.currency_code,
        'unitCode', c.unit_code,
        'chargeDirection', c.charge_direction,
        'taxTreatment', c.tax_treatment,
        'minimumAmount', c.minimum_amount,
        'maximumAmount', c.maximum_amount,
        'notes', c.notes
      )
      ORDER BY c.sequence_no
    ),
    '[]'::jsonb
  ) INTO v_pricing
  FROM public.quote_pricing_components c
  WHERE c.response_id = p_response.id;

  RETURN jsonb_build_object(
    'requestId', p_request.id,
    'publicReference', p_request.public_reference,
    'transactionType', p_request.transaction_type,
    'requestTerms', p_request.terms,
    'selectedResponseId', p_response.id,
    'responseTerms', p_response.response_terms,
    'pricingComponents', v_pricing,
    'requesterOrganizationId', p_requester_org,
    'requesterOrganizationLegalName', v_req_org.legal_name,
    'requesterOrganizationDisplayName', v_req_org.display_name,
    'counterpartyOrganizationId', p_counterparty_org,
    'counterpartyOrganizationLegalName', v_cp_org.legal_name,
    'counterpartyOrganizationDisplayName', v_cp_org.display_name,
    'requesterUserId', p_request.owner_user_id,
    'requesterUserDisplayName', public.display_name_for_user(p_request.owner_user_id),
    'counterpartyUserId', p_response.responder_user_id,
    'counterpartyUserDisplayName', public.display_name_for_user(p_response.responder_user_id),
    'requestSchemaVersion', p_request.schema_version,
    'responseSchemaVersion', p_response.schema_version,
    'bookedAt', now()
  );
END;
$$;

-- H-5: book marks the response accepted and writes the deal_booked RFQ event.
CREATE OR REPLACE FUNCTION public.book_quote_response_v2(request jsonb)
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
  v_requester_org uuid;
  v_counterparty_org uuid;
  v_deal_reference text;
  v_snapshot jsonb;
  v_deal_id uuid;
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

  IF NOT public.has_entitlement('DEAL_BOOK') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

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

  -- Single-award guard evaluated before status checks so any second attempt
  -- returns the same deterministic error.
  IF EXISTS (SELECT 1 FROM public.trade_deals WHERE request_id = v_request.id) THEN
    PERFORM public.raise_business_error('deal_already_booked');
  END IF;

  IF public.effective_quote_status(v_request.id) = 'expired' THEN
    PERFORM public.raise_business_error('rfq_expired');
  END IF;
  IF public.effective_quote_status(v_request.id) = 'converted' THEN
    PERFORM public.raise_business_error('rfq_closed');
  END IF;

  IF v_response.status NOT IN ('submitted', 'countered') THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;
  IF EXISTS (SELECT 1 FROM public.quote_response_decisions WHERE response_id = v_response_id) THEN
    PERFORM public.raise_business_error('invalid_status_transition');
  END IF;
  IF v_response.responder_user_id <> v_invitation.recipient_user_id THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  v_requester_org := v_request.requester_organization_id;
  v_counterparty_org := v_invitation.recipient_organization_id;

  v_snapshot := public.build_deal_snapshot(v_request, v_response, v_requester_org, v_counterparty_org);

  LOOP
    v_deal_reference := 'DEAL-' || upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.trade_deals WHERE deal_reference = v_deal_reference);
  END LOOP;

  INSERT INTO public.trade_deals (
    request_id, response_id, counterparty_user_id, booked_by_user_id,
    booking_client_action_id, product, volume, status, commercial_terms_snapshot,
    requester_organization_id, counterparty_organization_id, transaction_type,
    deal_reference, confirmation_status, booked_at, version
  )
  VALUES (
    v_request.id, v_response_id, v_invitation.recipient_user_id, v_uid,
    v_client_action_id, COALESCE(v_request.terms->'material'->>'productName', 'Trade'), '1', 'booked', v_snapshot,
    v_requester_org, v_counterparty_org, v_request.transaction_type,
    v_deal_reference, 'not_generated', now(), 1
  )
  RETURNING id INTO v_deal_id;

  INSERT INTO public.quote_response_decisions (response_id, decided_by_user_id, decision, client_action_id)
  VALUES (v_response_id, v_uid, 'accepted', v_client_action_id);

  UPDATE public.quote_responses SET status = 'accepted' WHERE id = v_response_id;

  UPDATE public.quote_requests SET status = 'awarded', closed_at = now(), close_reason = 'awarded', updated_at = now()
  WHERE id = v_request.id;

  -- Close all other invitations neutrally; no winner/price information leaks.
  UPDATE public.quote_request_invitations
  SET status = 'closed', closed_at = now(), close_reason = 'other_awarded'
  WHERE request_id = v_request.id AND id <> v_invitation.id;

  INSERT INTO public.deal_events (deal_id, actor_user_id, actor_organization_id, event_type, event_payload, correlation_id)
  VALUES (v_deal_id, v_uid, v_requester_org, 'deal_booked', jsonb_build_object('dealReference', v_deal_reference), v_client_action_id);

  INSERT INTO public.quote_request_events (request_id, invitation_id, actor_user_id, actor_organization_id, event_type)
  VALUES (v_request.id, v_invitation.id, v_uid, v_requester_org, 'deal_booked');

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_invitation.recipient_user_id, v_request.id,
    'Deal booked: ' || v_deal_reference
  );

  v_result := jsonb_build_object(
    'ok', true,
    'deal', jsonb_build_object(
      'id', v_deal_id, 'requestId', v_request.id, 'responseId', v_response_id,
      'dealReference', v_deal_reference, 'status', 'booked',
      'confirmationStatus', 'not_generated', 'transactionType', v_request.transaction_type,
      'commercialTermsSnapshot', v_snapshot, 'bookedAt', now()
    ),
    'message', jsonb_build_object(
      'id', v_message_id, 'conversationId', v_invitation.conversation_id,
      'senderUserId', v_uid, 'recipientUserId', v_invitation.recipient_user_id,
      'type', 'rfq', 'content', '', 'createdAt', now(), 'quoteRequestId', v_request.id
    )
  );

  INSERT INTO public.quote_workflow_idempotency (actor_user_id, client_operation_id, operation, canonical_request, result_snapshot, workflow_message_id, response_id, deal_id)
  VALUES (v_uid, v_client_action_id, 'book', v_canonical, v_result, v_message_id, v_response_id, v_deal_id);

  RETURN v_result;
END;
$$;

-- L-1: build_deal_snapshot is an internal helper, not client-callable.
REVOKE ALL ON FUNCTION public.build_deal_snapshot(public.quote_requests, public.quote_responses, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_quote_response_v2(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.book_quote_response_v2(jsonb) FROM PUBLIC, anon;
