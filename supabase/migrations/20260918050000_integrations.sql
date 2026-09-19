-- ============================================
-- Compliance and inventory integration (Phase 9)
-- ============================================

CREATE TABLE IF NOT EXISTS public.compliance_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  viewer_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  external_reference text,
  kyc_status text NOT NULL,
  kys_status text NOT NULL,
  trading_eligibility boolean NOT NULL DEFAULT false,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  source_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compliance_snapshots OWNER TO postgres;

CREATE INDEX IF NOT EXISTS compliance_snapshots_subject_viewer_idx
  ON public.compliance_snapshots (subject_organization_id, viewer_organization_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_system text NOT NULL,
  external_reference text NOT NULL,
  primary_metal text NOT NULL,
  material_form text NOT NULL,
  quantity numeric(28,8) NOT NULL,
  quantity_unit text NOT NULL,
  fineness numeric(12,8),
  location jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability_status text NOT NULL DEFAULT 'unknown',
  source_observed_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  raw_source_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT inventory_lots_unique UNIQUE (source_system, organization_id, external_reference),
  CONSTRAINT inventory_lots_availability_check CHECK (
    availability_status IN ('available', 'reserved', 'unavailable', 'unknown')
  )
);
ALTER TABLE public.inventory_lots OWNER TO postgres;

CREATE INDEX IF NOT EXISTS inventory_lots_org_idx ON public.inventory_lots (organization_id);

CREATE TABLE IF NOT EXISTS public.inventory_sync_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  lots_synced integer NOT NULL DEFAULT 0,
  lots_removed integer NOT NULL DEFAULT 0,
  error text,
  correlation_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT inventory_sync_runs_status_check CHECK (
    status IN ('running', 'completed', 'failed')
  )
);
ALTER TABLE public.inventory_sync_runs OWNER TO postgres;

-- ============================================
-- get_counterparty_summary (viewer-org scoped)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_counterparty_summary(p_subject_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_viewer_org uuid;
  v_snapshot public.compliance_snapshots;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;

  v_viewer_org := (public.current_organization_membership()->>'organizationId')::uuid;
  IF v_viewer_org IS NULL THEN
    PERFORM public.raise_business_error('no_active_organization');
  END IF;

  SELECT * INTO v_snapshot
  FROM public.compliance_snapshots
  WHERE subject_organization_id = p_subject_organization_id
    AND viewer_organization_id = v_viewer_org
  ORDER BY checked_at DESC
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    -- Explicit unavailable; never defaults to approved.
    RETURN jsonb_build_object(
      'subjectOrganizationId', p_subject_organization_id,
      'status', 'unavailable',
      'tradingEligibility', false,
      'reasonCodes', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'subjectOrganizationId', v_snapshot.subject_organization_id,
    'provider', v_snapshot.provider,
    'kycStatus', v_snapshot.kyc_status,
    'kysStatus', v_snapshot.kys_status,
    'tradingEligibility', v_snapshot.trading_eligibility,
    'status',
      CASE WHEN v_snapshot.expires_at IS NOT NULL AND v_snapshot.expires_at < now()
           THEN 'expired' ELSE v_snapshot.kyc_status END,
    'reasonCodes', v_snapshot.reason_codes,
    'checkedAt', v_snapshot.checked_at,
    'expiresAt', v_snapshot.expires_at
  );
END;
$$;

-- ============================================
-- list_inventory_projection (active-org scoped)
-- ============================================

CREATE OR REPLACE FUNCTION public.list_inventory_projection()
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
          'id', l.id,
          'sourceSystem', l.source_system,
          'externalReference', l.external_reference,
          'primaryMetal', l.primary_metal,
          'materialForm', l.material_form,
          'quantity', l.quantity::text,
          'quantityUnit', l.quantity_unit,
          'fineness', l.fineness,
          'location', l.location,
          'availabilityStatus', l.availability_status,
          'syncedAt', l.synced_at
        )
        ORDER BY l.primary_metal, l.external_reference
      )
      FROM public.inventory_lots l
      WHERE l.organization_id = v_org_id
    ),
    '[]'::jsonb
  );
END;
$$;

-- ============================================
-- RLS and grants
-- ============================================

ALTER TABLE public.compliance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sync_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.compliance_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_lots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_sync_runs FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_counterparty_summary(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_counterparty_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_inventory_projection() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_inventory_projection() FROM PUBLIC, anon;
