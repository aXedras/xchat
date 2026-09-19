-- ============================================
-- Quotation V2, counter offers and pricing components (Phase 7)
-- ============================================

-- quote_responses: add responder organization, schema version, structured
-- response_terms, validity and extended status. quoted_premium stays readable
-- (legacy schema version 0) and is no longer written by the V2 RPCs.
ALTER TABLE public.quote_responses
  ADD COLUMN IF NOT EXISTS responder_organization_id uuid,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_terms jsonb,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz;

-- Legacy-only column: V2 responses carry structured response_terms + pricing
-- components instead of a single quoted_premium string.
ALTER TABLE public.quote_responses ALTER COLUMN quoted_premium DROP NOT NULL;

UPDATE public.quote_responses r
SET responder_organization_id = m.organization_id
FROM public.organization_memberships m
WHERE m.user_id = r.responder_user_id
  AND m.status = 'active'
  AND r.responder_organization_id IS NULL;

ALTER TABLE public.quote_responses
  DROP CONSTRAINT IF EXISTS quote_responses_responder_org_fkey;
ALTER TABLE public.quote_responses
  ADD CONSTRAINT quote_responses_responder_org_fkey
  FOREIGN KEY (responder_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.quote_responses
  DROP CONSTRAINT IF EXISTS quote_responses_status_check;
ALTER TABLE public.quote_responses
  ADD CONSTRAINT quote_responses_status_check CHECK (
    status IN ('submitted', 'countered', 'superseded', 'withdrawn')
  );

ALTER TABLE public.quote_responses
  DROP CONSTRAINT IF EXISTS quote_responses_schema_version_check;
ALTER TABLE public.quote_responses
  ADD CONSTRAINT quote_responses_schema_version_check CHECK (schema_version >= 0);

-- ============================================
-- quote_pricing_components
-- ============================================

CREATE TABLE IF NOT EXISTS public.quote_pricing_components (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid NOT NULL REFERENCES public.quote_responses(id) ON DELETE RESTRICT,
  sequence_no integer NOT NULL,
  component_type text NOT NULL,
  label text NOT NULL,
  calculation_method text NOT NULL,
  numeric_value numeric(28,10),
  formula_text text,
  currency_code char(3),
  unit_code text,
  charge_direction text NOT NULL,
  tax_treatment text,
  minimum_amount numeric(28,10),
  maximum_amount numeric(28,10),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_pricing_components_sequence_check CHECK (sequence_no > 0),
  CONSTRAINT quote_pricing_components_unique UNIQUE (response_id, sequence_no),
  CONSTRAINT quote_pricing_components_type_check CHECK (
    component_type IN (
      'METAL_PRICE','PREMIUM','DISCOUNT','REFINING_CHARGE','TREATMENT_CHARGE',
      'ASSAY_FEE','FABRICATION_FEE','LOGISTICS_FEE','INSURANCE_FEE',
      'MINIMUM_CHARGE','TAX','BYPRODUCT_CREDIT','OTHER'
    )
  ),
  CONSTRAINT quote_pricing_components_method_check CHECK (
    calculation_method IN ('FIXED_AMOUNT','PER_UNIT','PERCENTAGE','BASIS_POINTS','FORMULA','INCLUDED')
  ),
  CONSTRAINT quote_pricing_components_direction_check CHECK (
    charge_direction IN ('PAYABLE_BY_REQUESTER','PAYABLE_BY_RESPONDER','CREDIT_TO_REQUESTER','CREDIT_TO_RESPONDER')
  ),
  CONSTRAINT quote_pricing_components_label_check CHECK (char_length(label) BETWEEN 1 AND 200),
  CONSTRAINT quote_pricing_components_minmax_check CHECK (
    minimum_amount IS NULL OR maximum_amount IS NULL OR minimum_amount <= maximum_amount
  )
);
ALTER TABLE public.quote_pricing_components OWNER TO postgres;

CREATE INDEX IF NOT EXISTS quote_pricing_components_response_idx
  ON public.quote_pricing_components (response_id, sequence_no);

-- Submitted responses and their pricing components are immutable.
-- The V1 trigger blocked ALL updates; replace it with a V2 trigger that allows
-- status-only transitions (supersede/withdraw) but never edits to terms/pricing.
DROP TRIGGER IF EXISTS prevent_quote_response_mutation ON public.quote_responses;

CREATE OR REPLACE FUNCTION public.prevent_quote_response_v2_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.raise_business_error('quote_response_immutable');
    RETURN NULL;
  END IF;
  IF NEW.response_terms IS DISTINCT FROM OLD.response_terms
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
     OR NEW.quoted_premium IS DISTINCT FROM OLD.quoted_premium
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.invitation_id IS DISTINCT FROM OLD.invitation_id
     OR NEW.responder_user_id IS DISTINCT FROM OLD.responder_user_id
     OR NEW.responder_organization_id IS DISTINCT FROM OLD.responder_organization_id
     OR NEW.parent_response_id IS DISTINCT FROM OLD.parent_response_id
     OR NEW.schema_version IS DISTINCT FROM OLD.schema_version THEN
    PERFORM public.raise_business_error('quote_response_immutable');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_quote_response_v2_mutation_trigger
  BEFORE UPDATE OR DELETE ON public.quote_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_quote_response_v2_mutation();

CREATE OR REPLACE FUNCTION public.prevent_pricing_component_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.raise_business_error('pricing_component_immutable');
  RETURN NULL;
END;
$$;

CREATE TRIGGER prevent_pricing_component_mutation_trigger
  BEFORE UPDATE OR DELETE ON public.quote_pricing_components
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_pricing_component_mutation();

-- ============================================
-- normalize_quote_response_v2
-- ============================================

CREATE OR REPLACE FUNCTION public.normalize_quote_response_v2(p_terms jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_commercial jsonb;
  v_valid_until timestamptz;
  v_component jsonb;
  v_method text;
BEGIN
  IF p_terms IS NULL OR jsonb_typeof(p_terms) <> 'object' THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_terms) k
    WHERE k NOT IN ('schemaVersion','commercial','material','assay','logistics','pricingComponents')
  ) THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;

  IF (p_terms->>'schemaVersion')::int IS DISTINCT FROM 1 THEN
    PERFORM public.raise_business_error('invalid_schema_version');
  END IF;

  v_commercial := p_terms->'commercial';
  IF jsonb_typeof(v_commercial) <> 'object' THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;

  BEGIN
    v_valid_until := (v_commercial->>'validUntil')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END;
  IF v_valid_until IS NULL OR v_valid_until <= clock_timestamp() THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;

  IF jsonb_typeof(p_terms->'pricingComponents') <> 'array'
     OR jsonb_array_length(p_terms->'pricingComponents') = 0 THEN
    PERFORM public.raise_business_error('invalid_quote_payload');
  END IF;

  FOR v_component IN SELECT jsonb_array_elements(p_terms->'pricingComponents') LOOP
    IF jsonb_typeof(v_component) <> 'object' THEN
      PERFORM public.raise_business_error('invalid_quote_payload');
    END IF;
    IF (v_component->>'componentType') NOT IN (
      'METAL_PRICE','PREMIUM','DISCOUNT','REFINING_CHARGE','TREATMENT_CHARGE',
      'ASSAY_FEE','FABRICATION_FEE','LOGISTICS_FEE','INSURANCE_FEE',
      'MINIMUM_CHARGE','TAX','BYPRODUCT_CREDIT','OTHER'
    ) THEN
      PERFORM public.raise_business_error('invalid_quote_payload');
    END IF;
    IF (v_component->>'chargeDirection') NOT IN (
      'PAYABLE_BY_REQUESTER','PAYABLE_BY_RESPONDER','CREDIT_TO_REQUESTER','CREDIT_TO_RESPONDER'
    ) THEN
      PERFORM public.raise_business_error('invalid_quote_payload');
    END IF;
    v_method := v_component->>'calculationMethod';
    IF v_method NOT IN ('FIXED_AMOUNT','PER_UNIT','PERCENTAGE','BASIS_POINTS','FORMULA','INCLUDED') THEN
      PERFORM public.raise_business_error('invalid_quote_payload');
    END IF;
    IF v_method IN ('FIXED_AMOUNT','PER_UNIT','PERCENTAGE','BASIS_POINTS')
       AND (v_component->>'numericValue') IS NULL THEN
      PERFORM public.raise_business_error('invalid_quote_payload');
    END IF;
    IF v_method = 'FORMULA' AND (v_component->>'formulaText') IS NULL THEN
      PERFORM public.raise_business_error('invalid_quote_payload');
    END IF;
  END LOOP;

  RETURN p_terms;
END;
$$;

-- ============================================
-- submit_quote_response_v2
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
  v_component jsonb;
  v_seq int := 0;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
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

  FOR v_component IN SELECT jsonb_array_elements(v_terms->'pricingComponents') LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.quote_pricing_components (
      response_id, sequence_no, component_type, label, calculation_method,
      numeric_value, formula_text, currency_code, unit_code, charge_direction,
      tax_treatment, minimum_amount, maximum_amount, notes
    )
    VALUES (
      v_response_id, v_seq,
      v_component->>'componentType', v_component->>'label', v_component->>'calculationMethod',
      NULLIF(v_component->>'numericValue','')::numeric, NULLIF(v_component->>'formulaText',''),
      NULLIF(v_component->>'currencyCode',''), NULLIF(v_component->>'unitCode',''),
      v_component->>'chargeDirection', v_component->>'taxTreatment',
      NULLIF(v_component->>'minimumAmount','')::numeric, NULLIF(v_component->>'maximumAmount','')::numeric,
      NULLIF(v_component->>'notes','')
    );
  END LOOP;

  UPDATE public.quote_request_invitations
  SET status = 'responded', responded_at = now()
  WHERE id = v_invitation_id;

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
-- counter_quote_response_v2 (append-only child)
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
  v_component jsonb;
  v_seq int := 0;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
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

  FOR v_component IN SELECT jsonb_array_elements(v_terms->'pricingComponents') LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.quote_pricing_components (
      response_id, sequence_no, component_type, label, calculation_method,
      numeric_value, formula_text, currency_code, unit_code, charge_direction,
      tax_treatment, minimum_amount, maximum_amount, notes
    )
    VALUES (
      v_response_id, v_seq,
      v_component->>'componentType', v_component->>'label', v_component->>'calculationMethod',
      NULLIF(v_component->>'numericValue','')::numeric, NULLIF(v_component->>'formulaText',''),
      NULLIF(v_component->>'currencyCode',''), NULLIF(v_component->>'unitCode',''),
      v_component->>'chargeDirection', v_component->>'taxTreatment',
      NULLIF(v_component->>'minimumAmount','')::numeric, NULLIF(v_component->>'maximumAmount','')::numeric,
      NULLIF(v_component->>'notes','')
    );
  END LOOP;

  UPDATE public.quote_responses SET status = 'superseded' WHERE id = v_parent_response_id AND status <> 'superseded';

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
-- withdraw_quote_response
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
-- decline_quote_invitation
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
-- reject_quote_response_v2
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

  v_message_id := public.create_workflow_message(
    v_invitation.conversation_id, v_uid, v_invitation.recipient_user_id, v_request.id,
    'Quote rejected for ' || COALESCE(v_request.public_reference, 'RFQ')
  );

  v_result := jsonb_build_object(
    'ok', true,
    'response', jsonb_build_object(
      'id', v_response_id, 'invitationId', v_invitation.id, 'parentResponseId', v_response.parent_response_id,
      'responderUserId', v_response.responder_user_id, 'createdAt', v_response.created_at,
      'status', v_response.status, 'decision', 'rejected', 'schemaVersion', v_response.schema_version
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
-- RLS and grants
-- ============================================

ALTER TABLE public.quote_pricing_components ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_pricing_components FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.normalize_quote_response_v2(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_quote_response_v2(jsonb) FROM PUBLIC, anon;
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
