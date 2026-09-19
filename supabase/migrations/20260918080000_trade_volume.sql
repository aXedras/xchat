-- ============================================
-- Trade volume ledger and controlled CSV import (Phase 11)
-- ============================================

CREATE TABLE IF NOT EXISTS public.trade_volume_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  counterparty_organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  deal_id uuid REFERENCES public.trade_deals(id) ON DELETE RESTRICT,
  source_type text NOT NULL,
  source_reference text,
  primary_metal text NOT NULL,
  quantity numeric(28,8) NOT NULL,
  quantity_unit text NOT NULL,
  normalized_grams numeric(28,8),
  trade_date timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_volume_entries_source_type_check CHECK (
    source_type IN ('xchat_deal', 'csv_import', 'adjustment')
  ),
  CONSTRAINT trade_volume_entries_metal_check CHECK (
    primary_metal IN ('AU', 'AG', 'PT', 'PD', 'OTHER')
  )
);
ALTER TABLE public.trade_volume_entries OWNER TO postgres;

-- Idempotent deal entries: one xchat_deal entry per organization per deal.
CREATE UNIQUE INDEX IF NOT EXISTS trade_volume_entries_deal_unique
  ON public.trade_volume_entries (organization_id, deal_id)
  WHERE source_type = 'xchat_deal' AND deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trade_volume_entries_org_idx
  ON public.trade_volume_entries (organization_id, trade_date);

CREATE TABLE IF NOT EXISTS public.trade_volume_import_batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'uploaded',
  file_name text NOT NULL,
  file_hash text NOT NULL,
  original_key text,
  correlation_id uuid,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_volume_import_batches_status_check CHECK (
    status IN ('uploaded', 'validating', 'validation_failed', 'ready', 'committing', 'completed', 'failed')
  )
);
ALTER TABLE public.trade_volume_import_batches OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.trade_volume_import_rows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.trade_volume_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  status text NOT NULL DEFAULT 'valid',
  row_hash text NOT NULL,
  error_code text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  entry_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_volume_import_rows_status_check CHECK (
    status IN ('valid', 'invalid', 'duplicate', 'committed')
  ),
  CONSTRAINT trade_volume_import_rows_unique UNIQUE (batch_id, row_number)
);
ALTER TABLE public.trade_volume_import_rows OWNER TO postgres;

CREATE INDEX IF NOT EXISTS trade_volume_import_rows_batch_idx
  ON public.trade_volume_import_rows (batch_id);

-- ============================================
-- Deal booking creates idempotent volume entries (synchronous until the
-- outbox consumer lands in Phase 12).
-- ============================================

CREATE OR REPLACE FUNCTION public.create_trade_volume_entries_on_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metal text;
  v_quantity numeric;
  v_unit text;
  v_grams numeric;
  v_requester_org uuid;
  v_counterparty_org uuid;
BEGIN
  -- Only structured (V2) deals carry a parseable material block.
  IF NEW.commercial_terms_snapshot->'requestTerms'->'material' IS NULL THEN
    RETURN NEW;
  END IF;

  v_metal := NEW.commercial_terms_snapshot->'requestTerms'->'material'->>'primaryMetal';
  v_quantity := NULLIF(NEW.commercial_terms_snapshot->'requestTerms'->'material'->>'quantity', '')::numeric;
  v_unit := NEW.commercial_terms_snapshot->'requestTerms'->'material'->>'quantityUnit';

  IF v_metal IS NULL OR v_quantity IS NULL OR v_unit IS NULL THEN
    RETURN NEW;
  END IF;

  v_grams := CASE v_unit
    WHEN 'KG' THEN v_quantity * 1000
    WHEN 'G' THEN v_quantity
    WHEN 'TOZ' THEN v_quantity * 31.1034768
    WHEN 'MT' THEN v_quantity * 1000000
    ELSE NULL
  END;

  v_requester_org := NEW.requester_organization_id;
  v_counterparty_org := NEW.counterparty_organization_id;

  IF v_requester_org IS NOT NULL THEN
    INSERT INTO public.trade_volume_entries (
      organization_id, counterparty_organization_id, deal_id, source_type,
      source_reference, primary_metal, quantity, quantity_unit, normalized_grams, trade_date
    )
    VALUES (v_requester_org, v_counterparty_org, NEW.id, 'xchat_deal', NEW.deal_reference, v_metal, v_quantity, v_unit, v_grams, NEW.booked_at)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_counterparty_org IS NOT NULL THEN
    INSERT INTO public.trade_volume_entries (
      organization_id, counterparty_organization_id, deal_id, source_type,
      source_reference, primary_metal, quantity, quantity_unit, normalized_grams, trade_date
    )
    VALUES (v_counterparty_org, v_requester_org, NEW.id, 'xchat_deal', NEW.deal_reference, v_metal, v_quantity, v_unit, v_grams, NEW.booked_at)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_trade_volume_entries_on_deal_trigger
  AFTER INSERT ON public.trade_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trade_volume_entries_on_deal();

-- ============================================
-- list_trade_volume (org-scoped aggregation)
-- ============================================

CREATE OR REPLACE FUNCTION public.list_trade_volume(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
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
  IF v_org_id IS NULL THEN
    PERFORM public.raise_business_error('no_active_organization');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'counterpartyOrganizationId', g.counterparty_organization_id,
          'sourceType', g.source_type,
          'primaryMetal', g.primary_metal,
          'quantity', g.total_quantity::text,
          'normalizedGrams', g.total_grams::text
        )
        ORDER BY g.primary_metal, g.counterparty_organization_id
      )
      FROM (
        SELECT e.counterparty_organization_id, e.source_type, e.primary_metal,
               sum(e.quantity) AS total_quantity,
               sum(e.normalized_grams) AS total_grams
        FROM public.trade_volume_entries e
        WHERE e.organization_id = v_org_id
          AND (p_from IS NULL OR e.trade_date >= p_from)
          AND (p_to IS NULL OR e.trade_date <= p_to)
        GROUP BY e.counterparty_organization_id, e.source_type, e.primary_metal
      ) g
    ),
    '[]'::jsonb
  );
END;
$$;

-- ============================================
-- reconcile_trade_volume (deals without a volume entry)
-- ============================================

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

-- ============================================
-- RLS and grants
-- ============================================

ALTER TABLE public.trade_volume_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_volume_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_volume_import_rows ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.trade_volume_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trade_volume_import_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.trade_volume_import_rows FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_trade_volume(timestamptz, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_trade_volume(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_trade_volume() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_trade_volume() FROM PUBLIC, anon;
