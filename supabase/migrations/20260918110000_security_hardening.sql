-- ============================================
-- Security hardening (Phase 13)
-- ============================================

-- Harden the quotation validator to reject non-numeric / overflowing values
-- before they reach the numeric(28,10) columns (tampered pricing components).
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
  v_numeric text;
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
     OR jsonb_array_length(p_terms->'pricingComponents') = 0
     OR jsonb_array_length(p_terms->'pricingComponents') > 100 THEN
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
    IF v_method IN ('FIXED_AMOUNT','PER_UNIT','PERCENTAGE','BASIS_POINTS') THEN
      v_numeric := v_component->>'numericValue';
      IF v_numeric IS NULL OR v_numeric !~ '^-?\d{1,18}(\.\d{1,10})?$' THEN
        PERFORM public.raise_business_error('invalid_quote_payload');
      END IF;
      IF (v_component->>'minimumAmount') IS NOT NULL
         AND (v_component->>'minimumAmount') !~ '^-?\d{1,18}(\.\d{1,10})?$' THEN
        PERFORM public.raise_business_error('invalid_quote_payload');
      END IF;
      IF (v_component->>'maximumAmount') IS NOT NULL
         AND (v_component->>'maximumAmount') !~ '^-?\d{1,18}(\.\d{1,10})?$' THEN
        PERFORM public.raise_business_error('invalid_quote_payload');
      END IF;
    END IF;
    IF v_method = 'FORMULA' AND (v_component->>'formulaText') IS NULL THEN
      PERFORM public.raise_business_error('invalid_quote_payload');
    END IF;
  END LOOP;

  RETURN p_terms;
END;
$$;
