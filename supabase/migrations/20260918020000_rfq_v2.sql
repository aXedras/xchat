-- ============================================
-- RFQ data model V2 and secure dispatch (Phase 4)
-- ============================================
-- Adds organization/transaction/schema columns to the RFQ aggregate, extends
-- invitation status/timestamps, introduces the append-only quote_request_events
-- audit table, and implements the V2 validation + dispatch RPCs with strict
-- recipient isolation.

-- ============================================
-- quote_requests extensions
-- ============================================

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS requester_organization_id uuid,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_reference text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS close_reason text;

-- Backfill requester_organization_id from the owner's active membership.
UPDATE public.quote_requests q
SET requester_organization_id = m.organization_id,
    updated_at = now()
FROM public.organization_memberships m
WHERE m.user_id = q.owner_user_id
  AND m.status = 'active'
  AND q.requester_organization_id IS NULL;

-- Fallback: most recent historical membership for owners no longer active.
UPDATE public.quote_requests q
SET requester_organization_id = m.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_memberships
  ORDER BY user_id, valid_from DESC
) m
WHERE m.user_id = q.owner_user_id
  AND q.requester_organization_id IS NULL;

-- Fail loudly instead of silently assigning a wrong organization for rows that
-- cannot be resolved from any membership. (The column stays nullable so that the
-- legacy V1 send_messages flow — schema version 0 — keeps working; V2 rows are
-- always written with a derived organization.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.quote_requests q
    WHERE q.requester_organization_id IS NULL AND q.schema_version >= 1
  ) THEN
    RAISE EXCEPTION 'quote_requests backfill: % V2 row(s) have no requester_organization_id',
      (SELECT count(*) FROM public.quote_requests WHERE requester_organization_id IS NULL AND schema_version >= 1);
  END IF;
END $$;

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_requester_org_fkey;
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_requester_org_fkey
  FOREIGN KEY (requester_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- Derive requester_organization_id from the owner's active membership whenever
-- an insert does not provide one (keeps legacy V1 send_messages consistent).
CREATE OR REPLACE FUNCTION public.set_requester_organization_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.requester_organization_id IS NULL THEN
    SELECT m.organization_id INTO NEW.requester_organization_id
    FROM public.organization_memberships m
    WHERE m.user_id = NEW.owner_user_id
      AND m.status = 'active'
      AND (m.valid_until IS NULL OR m.valid_until > now())
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_requester_organization_trigger
  BEFORE INSERT ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_requester_organization_on_insert();

-- transaction_type: nullable for legacy (version 0), constrained otherwise.
ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_transaction_type_check;
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_transaction_type_check CHECK (
    transaction_type IS NULL OR transaction_type IN (
      'REFINE_AND_RETURN', 'SELL_DORE', 'REFINE_AND_SELL', 'BUY_REFINED_METAL',
      'SELL_REFINED_METAL', 'FABRICATE_METAL', 'BUY_FEEDSTOCK'
    )
  );

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_schema_version_check;
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_schema_version_check CHECK (schema_version >= 0);

-- Extended status machine (legacy 'converted' remains readable).
ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_status_check;
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_status_check CHECK (
    status IN ('draft', 'open', 'awarded', 'converted', 'closed_no_award', 'expired', 'cancelled')
  );

CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_public_reference_unique
  ON public.quote_requests (public_reference)
  WHERE public_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS quote_requests_requester_org_created_idx
  ON public.quote_requests (requester_organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quote_requests_status_deadline_idx
  ON public.quote_requests (status, response_deadline);

CREATE INDEX IF NOT EXISTS quote_requests_transaction_type_idx
  ON public.quote_requests (transaction_type, created_at DESC);

-- ============================================
-- quote_request_invitations extensions
-- ============================================

ALTER TABLE public.quote_request_invitations
  ADD COLUMN IF NOT EXISTS recipient_organization_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'delivered',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS close_reason text;

-- Legacy invitations were delivered at creation time.
UPDATE public.quote_request_invitations
SET delivered_at = created_at
WHERE delivered_at IS NULL;

ALTER TABLE public.quote_request_invitations
  ALTER COLUMN delivered_at SET DEFAULT now();

ALTER TABLE public.quote_request_invitations
  ALTER COLUMN delivered_at SET NOT NULL;

-- Backfill recipient_organization_id from the recipient's membership.
UPDATE public.quote_request_invitations i
SET recipient_organization_id = m.organization_id
FROM public.organization_memberships m
WHERE m.user_id = i.recipient_user_id
  AND m.status = 'active'
  AND i.recipient_organization_id IS NULL;

ALTER TABLE public.quote_request_invitations
  DROP CONSTRAINT IF EXISTS quote_request_invitations_recipient_org_fkey;
ALTER TABLE public.quote_request_invitations
  ADD CONSTRAINT quote_request_invitations_recipient_org_fkey
  FOREIGN KEY (recipient_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.quote_request_invitations
  DROP CONSTRAINT IF EXISTS quote_request_invitations_status_check;
ALTER TABLE public.quote_request_invitations
  ADD CONSTRAINT quote_request_invitations_status_check CHECK (
    status IN ('sent', 'delivered', 'viewed', 'responded', 'declined', 'closed', 'expired')
  );

-- Monotonic view timestamps shape.
ALTER TABLE public.quote_request_invitations
  DROP CONSTRAINT IF EXISTS quote_request_invitations_view_ts_check;
ALTER TABLE public.quote_request_invitations
  ADD CONSTRAINT quote_request_invitations_view_ts_check CHECK (
    (first_viewed_at IS NULL AND last_viewed_at IS NULL)
    OR (first_viewed_at IS NOT NULL AND last_viewed_at >= first_viewed_at)
  );

-- ============================================
-- quote_request_events (append-only audit)
-- ============================================

CREATE TABLE IF NOT EXISTS public.quote_request_events (
  id bigserial PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  invitation_id uuid REFERENCES public.quote_request_invitations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_request_events OWNER TO postgres;

CREATE INDEX IF NOT EXISTS quote_request_events_request_idx
  ON public.quote_request_events (request_id, id);

ALTER TABLE public.quote_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_request_events FROM PUBLIC, anon, authenticated;

-- ============================================
-- effective_quote_status: keep legacy consumers correct for new statuses
-- ============================================

CREATE OR REPLACE FUNCTION public.effective_quote_status(p_request_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN q.status IN ('awarded', 'converted', 'closed_no_award', 'cancelled') THEN 'converted'
    WHEN q.response_deadline IS NULL OR clock_timestamp() < q.response_deadline THEN 'open'
    ELSE 'expired'
  END
  FROM public.quote_requests q
  WHERE q.id = p_request_id;
$$;

-- ============================================
-- V2 term normalization/validation
-- ============================================

CREATE OR REPLACE FUNCTION public.normalize_rfq_terms_v2(p_terms jsonb, p_transaction_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_commercial jsonb;
  v_material jsonb;
  v_assay jsonb;
  v_logistics jsonb;
  v_deadline timestamptz;
  v_key text;
  v_value jsonb;
  v_scalar text;
BEGIN
  IF p_terms IS NULL OR jsonb_typeof(p_terms) <> 'object' THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  IF p_transaction_type IS NULL OR p_transaction_type NOT IN (
    'REFINE_AND_RETURN', 'SELL_DORE', 'REFINE_AND_SELL', 'BUY_REFINED_METAL',
    'SELL_REFINED_METAL', 'FABRICATE_METAL', 'BUY_FEEDSTOCK'
  ) THEN
    PERFORM public.raise_business_error('invalid_transaction_type');
  END IF;

  -- Unknown root keys are rejected.
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_terms) k
    WHERE k NOT IN ('schemaVersion', 'commercial', 'material', 'assay', 'logistics')
  ) THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  IF (p_terms->>'schemaVersion')::int IS DISTINCT FROM 1 THEN
    PERFORM public.raise_business_error('invalid_schema_version');
  END IF;

  v_commercial := p_terms->'commercial';
  v_material := p_terms->'material';
  v_assay := p_terms->'assay';
  v_logistics := p_terms->'logistics';

  IF jsonb_typeof(v_commercial) <> 'object'
     OR jsonb_typeof(v_material) <> 'object'
     OR jsonb_typeof(v_assay) <> 'object'
     OR jsonb_typeof(v_logistics) <> 'object' THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  -- Tab allowlists (common fields plus every macro extension).
  FOR v_key IN SELECT jsonb_object_keys(v_commercial) LOOP
    IF NOT v_key = ANY(ARRAY[
      'transactionType','reference','responseDeadline','settlementCurrency',
      'priceBasisPreference','benchmarkPreference','paymentTermsPreference',
      'taxContext','partialFulfilmentAllowed','notes','turnaroundTime',
      'metalAccountTarget','returnForm','minimumRecovery','settlementTiming',
      'saleAssayBasis','priceFixingWindow','refiningFeesTreatment',
      'desiredFabricationDate','serviceScope','purchaseTerms'
    ]) THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
  END LOOP;

  FOR v_key IN SELECT jsonb_object_keys(v_material) LOOP
    IF NOT v_key = ANY(ARRAY[
      'primaryMetal','materialForm','productName','productCode','quantity',
      'quantityUnit','quantityTolerancePct','declaredFineness','lotCount',
      'packaging','inventoryReferences','feedstockType','dryWetWeight',
      'moisturePct','expectedFineMetals','deleteriousElements','batchLotInfo',
      'doreWeight','expectedMetalContents','originReference','lotReferences',
      'brand','refinery','accreditation','barSize','pieceCount',
      'serialAvailability','custodyContext','barListReference','condition',
      'provenanceReference','metalAccountReference','availableBalance',
      'targetProducts','targetPieceCount','targetFineness','targetBrand',
      'targetPackaging','soughtMaterial','quantityBand','acceptedOrigin',
      'assayBand','deliveryWindow'
    ]) THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
  END LOOP;

  FOR v_key IN SELECT jsonb_object_keys(v_assay) LOOP
    IF NOT v_key = ANY(ARRAY[
      'assayStatus','assayMethod','assayDate','laboratoryName',
      'declaredComposition','settlementAssayPreference','samplingMethod',
      'umpireTerms','assayDocumentIds','samplingSplitting','finalAssayAuthority',
      'umpireRules','existingAssayReference','settlementAssayMethod',
      'certificateReference','accountBalanceProofReference','assayRequirements'
    ]) THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
  END LOOP;

  FOR v_key IN SELECT jsonb_object_keys(v_logistics) LOOP
    IF NOT v_key = ANY(ARRAY[
      'currentLocation','deliveryLocation','availabilityFrom','deliveryWindowEnd',
      'incoterm','transportResponsibility','insuranceResponsibility',
      'securityRequirements','exportImportConstraints','logisticsDocumentIds',
      'deliveryToRefinery','returnLogistics','pickupLocation','riskTransferPoint',
      'allocation','deliveryMethod','handoverLocation','transferMethod',
      'deliveryPreference','shipping'
    ]) THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
  END LOOP;

  -- transactionType must match the selected macro.
  IF (v_commercial->>'transactionType') IS DISTINCT FROM p_transaction_type THEN
    PERFORM public.raise_business_error('invalid_transaction_type');
  END IF;

  -- responseDeadline: required, valid, future, within horizon.
  BEGIN
    v_deadline := (v_commercial->>'responseDeadline')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_deadline');
  END;
  IF v_deadline IS NULL OR v_deadline <= clock_timestamp() THEN
    PERFORM public.raise_business_error('invalid_deadline');
  END IF;
  IF v_deadline > clock_timestamp() + interval '365 days' THEN
    PERFORM public.raise_business_error('invalid_deadline');
  END IF;

  -- partialFulfilmentAllowed must be false in Release 1.
  IF jsonb_typeof(v_commercial->'partialFulfilmentAllowed') <> 'boolean'
     OR (v_commercial->'partialFulfilmentAllowed')::boolean THEN
    PERFORM public.raise_business_error('partial_fulfilment_not_allowed');
  END IF;

  -- Required material fields and enums.
  IF (v_material->>'primaryMetal') NOT IN ('AU','AG','PT','PD','OTHER') THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;
  IF (v_material->>'materialForm') NOT IN (
    'DORE','CONCENTRATE','ORE','SCRAP','BAR','GRAIN','ACCOUNT_BALANCE'
  ) THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;
  IF (v_material->>'productName') IS NULL
     OR char_length(v_material->>'productName') NOT BETWEEN 1 AND 200 THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  v_scalar := v_material->>'quantity';
  IF v_scalar IS NULL OR v_scalar !~ '^\d+(\.\d+)?$'
     OR (v_scalar)::numeric <= 0 THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;
  IF (v_material->>'quantityUnit') NOT IN ('KG','G','TOZ','MT','PCS') THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  -- Optional decimal fields.
  IF v_material ? 'declaredFineness' AND jsonb_typeof(v_material->'declaredFineness') <> 'null' THEN
    v_scalar := v_material->>'declaredFineness';
    IF v_scalar !~ '^\d+(\.\d+)?$' OR (v_scalar)::numeric > 1 THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
  END IF;
  IF v_material ? 'quantityTolerancePct' AND jsonb_typeof(v_material->'quantityTolerancePct') <> 'null' THEN
    v_scalar := v_material->>'quantityTolerancePct';
    IF v_scalar !~ '^\d+(\.\d+)?$' OR (v_scalar)::numeric > 100 THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
  END IF;

  -- Required assay status.
  IF (v_assay->>'assayStatus') NOT IN ('NOT_AVAILABLE','PROVISIONAL','FINAL') THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;

  -- Required logistics.
  IF jsonb_typeof(v_logistics->'currentLocation') <> 'object'
     OR (v_logistics->'currentLocation'->>'countryCode') IS NULL
     OR (v_logistics->'currentLocation'->>'locality') IS NULL THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END IF;
  BEGIN
    IF (v_logistics->>'availabilityFrom')::timestamptz IS NULL THEN
      PERFORM public.raise_business_error('invalid_rfq_terms');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.raise_business_error('invalid_rfq_terms');
  END;

  RETURN p_terms;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_quote_request(p_terms jsonb, p_transaction_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;
  PERFORM public.normalize_rfq_terms_v2(p_terms, p_transaction_type);
  RETURN jsonb_build_object('ok', true, 'transactionType', p_transaction_type);
END;
$$;

-- ============================================
-- list_available_transaction_types
-- ============================================

CREATE OR REPLACE FUNCTION public.list_available_transaction_types()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_can_create boolean;
  v_result jsonb := '[]'::jsonb;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  v_can_create := public.has_entitlement('RFQ_CREATE');

  FOREACH v_code IN ARRAY ARRAY[
    'REFINE_AND_RETURN','SELL_DORE','REFINE_AND_SELL','BUY_REFINED_METAL',
    'SELL_REFINED_METAL','FABRICATE_METAL','BUY_FEEDSTOCK'
  ] LOOP
    v_result := v_result || jsonb_build_object('code', v_code, 'available', v_can_create);
  END LOOP;

  RETURN v_result;
END;
$$;

-- ============================================
-- create_and_dispatch_quote_request_v2
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

  -- Requester organization is derived exclusively from the active membership;
  -- any client-supplied organization id is ignored.
  IF NOT public.has_entitlement('RFQ_CREATE') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;
  IF v_org_id IS NULL THEN
    PERFORM public.raise_business_error('no_active_organization');
  END IF;

  -- Validate + normalize terms before any write.
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

    -- Reject a replay that carries a different payload for the same operation id.
    IF EXISTS (
      SELECT 1 FROM public.quote_requests q
      WHERE q.id = v_request_id
        AND (q.transaction_type IS DISTINCT FROM v_transaction_type
             OR q.terms IS DISTINCT FROM v_terms)
    ) THEN
      PERFORM public.raise_business_error('idempotency_payload_mismatch');
    END IF;
  ELSE
    -- Generate a non-guessable display reference.
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
    -- Idempotent replay: return the stored result without writing.
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

      -- Recipient must hold an active membership in an active organization with
      -- at least one active capability.
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

-- ============================================
-- Requester and recipient projections (separate)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_quote_request_projection(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.quote_requests;
  v_invitations jsonb;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  SELECT * INTO v_request FROM public.quote_requests WHERE id = p_request_id;
  IF v_request IS NULL OR v_request.owner_user_id <> v_uid THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'invitationId', i.id,
      'recipientUserId', i.recipient_user_id,
      'recipientOrganizationId', i.recipient_organization_id,
      'status', i.status,
      'deliveredAt', i.delivered_at,
      'firstViewedAt', i.first_viewed_at,
      'respondedAt', i.responded_at,
      'closedAt', i.closed_at
    ) ORDER BY i.created_at ASC),
    '[]'::jsonb
  ) INTO v_invitations
  FROM public.quote_request_invitations i
  WHERE i.request_id = p_request_id;

  RETURN jsonb_build_object(
    'id', v_request.id,
    'publicReference', v_request.public_reference,
    'transactionType', v_request.transaction_type,
    'schemaVersion', v_request.schema_version,
    'status', v_request.status,
    'effectiveStatus', public.effective_quote_status(v_request.id),
    'responseDeadline', v_request.response_deadline,
    'terms', v_request.terms,
    'createdAt', v_request.created_at,
    'closedAt', v_request.closed_at,
    'closeReason', v_request.close_reason,
    'invitations', v_invitations
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quote_invitation_projection(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = p_invitation_id;
  IF v_invitation IS NULL OR v_invitation.recipient_user_id <> v_uid THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id;

  -- Recipient projection never exposes sibling invitations, counts or winner data.
  RETURN jsonb_build_object(
    'invitationId', v_invitation.id,
    'requestId', v_request.id,
    'publicReference', v_request.public_reference,
    'transactionType', v_request.transaction_type,
    'status', v_invitation.status,
    'effectiveStatus', public.effective_quote_status(v_request.id),
    'responseDeadline', v_request.response_deadline,
    'terms', v_request.terms,
    'createdAt', v_invitation.created_at,
    'deliveredAt', v_invitation.delivered_at,
    'firstViewedAt', v_invitation.first_viewed_at,
    'respondedAt', v_invitation.responded_at
  );
END;
$$;

-- ============================================
-- mark_quote_invitation_viewed
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_quote_invitation_viewed(p_invitation_id uuid)
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

  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;

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

-- ============================================
-- cancel_quote_request
-- ============================================

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
  WHERE request_id = p_request_id;

  INSERT INTO public.quote_request_events (request_id, actor_user_id, actor_organization_id, event_type)
  VALUES (p_request_id, v_uid, v_request.requester_organization_id, 'rfq_cancelled');

  RETURN jsonb_build_object('ok', true, 'requestId', p_request_id);
END;
$$;

-- ============================================
-- Grants and revokes
-- ============================================

GRANT EXECUTE ON FUNCTION public.normalize_rfq_terms_v2(jsonb, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_rfq_terms_v2(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_quote_request(jsonb, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_quote_request(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_available_transaction_types() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_available_transaction_types() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_dispatch_quote_request_v2(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_and_dispatch_quote_request_v2(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quote_request_projection(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_quote_request_projection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quote_invitation_projection(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_quote_invitation_projection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_quote_invitation_viewed(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_quote_invitation_viewed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_quote_request(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_quote_request(uuid) FROM PUBLIC, anon;
