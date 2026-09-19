-- ============================================
-- Organizations, capabilities, roles and entitlements (Phase 2)
-- ============================================
-- Normalized organization model: organizations, time-boxed capabilities,
-- organizational units, historical memberships, platform roles/entitlements
-- and organization-scoped user roles. Also introduces the server-authoritative
-- feature_flag store.
--
-- All writes to these tables go exclusively through SECURITY DEFINER RPCs.
-- Direct client access is denied (RLS enabled, no table grants).

-- ============================================
-- Reference data: feature flags
-- ============================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_flags OWNER TO postgres;

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('tradingOrganizationsV2', false, 'Organizations, memberships, capabilities, roles, entitlements'),
  ('transactionRfqV2', false, 'Transaction-specific RFQ forms and dispatch'),
  ('quotationV2', false, 'Quotation, counter offers, pricing components'),
  ('dealV2', false, 'Booking and deal snapshot'),
  ('documentsV1', false, 'Document storage and Typst pipeline'),
  ('tradeVolumeV1', false, 'Trade volume ledger and CSV import')
ON CONFLICT (key) DO NOTHING;

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- organizations
-- ============================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  legal_name text NOT NULL,
  display_name text NOT NULL,
  registration_number text,
  lei text,
  jurisdiction_country_code char(2),
  status text NOT NULL DEFAULT 'pending',
  source_system text NOT NULL DEFAULT 'xchat',
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_legal_name_length CHECK (char_length(legal_name) BETWEEN 1 AND 300),
  CONSTRAINT organizations_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 160),
  CONSTRAINT organizations_status CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
  CONSTRAINT organizations_source_system CHECK (source_system IN ('xchat', 'bil', 'import')),
  CONSTRAINT organizations_jurisdiction_country_code CHECK (
    jurisdiction_country_code IS NULL OR jurisdiction_country_code ~ '^[A-Z][A-Z]$'
  ),
  CONSTRAINT organizations_lei CHECK (lei IS NULL OR lei ~ '^[0-9A-Z]{20}$')
);
ALTER TABLE public.organizations OWNER TO postgres;

COMMENT ON TABLE public.organizations IS 'Normalized legal/organizational entities participating on xChat';

CREATE UNIQUE INDEX organizations_external_reference_unique
  ON public.organizations (source_system, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE INDEX organizations_display_name_lower_idx
  ON public.organizations (lower(display_name));

CREATE INDEX organizations_status_idx
  ON public.organizations (status);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- organization_capabilities
-- ============================================

CREATE TABLE IF NOT EXISTS public.organization_capabilities (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  capability_code text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, capability_code, valid_from),
  CONSTRAINT organization_capabilities_code CHECK (
    capability_code IN (
      'MINE_OPERATOR', 'CPP', 'REFINER', 'TRADER', 'DEALER', 'BANK', 'VAULT',
      'FABRICATOR', 'MINT', 'LOGISTICS_PROVIDER', 'INVESTOR', 'AUDITOR', 'OTHER'
    )
  ),
  CONSTRAINT organization_capabilities_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT organization_capabilities_validity CHECK (valid_until IS NULL OR valid_until > valid_from)
);
ALTER TABLE public.organization_capabilities OWNER TO postgres;

-- At most one currently active capability per (organization, code).
CREATE UNIQUE INDEX organization_capabilities_one_active
  ON public.organization_capabilities (organization_id, capability_code)
  WHERE status = 'active';

-- ============================================
-- organization_units
-- ============================================

CREATE TABLE IF NOT EXISTS public.organization_units (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  parent_unit_id uuid REFERENCES public.organization_units(id) ON DELETE RESTRICT,
  unit_type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_units_type CHECK (unit_type IN ('department', 'desk', 'site')),
  CONSTRAINT organization_units_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT organization_units_status CHECK (status IN ('active', 'inactive'))
);
ALTER TABLE public.organization_units OWNER TO postgres;

CREATE INDEX organization_units_org_status_idx
  ON public.organization_units (organization_id, status);

CREATE TRIGGER update_organization_units_updated_at
  BEFORE UPDATE ON public.organization_units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_unit_parent_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent_org uuid;
BEGIN
  IF NEW.parent_unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_parent_org
  FROM public.organization_units
  WHERE id = NEW.parent_unit_id;

  IF v_parent_org IS NULL OR v_parent_org <> NEW.organization_id THEN
    PERFORM public.raise_business_error('cross_organization_unit_parent');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_unit_parent_organization_trigger
  BEFORE INSERT OR UPDATE ON public.organization_units
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_unit_parent_organization();

-- ============================================
-- organization_memberships
-- ============================================

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  primary_unit_id uuid REFERENCES public.organization_units(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  job_title text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_memberships_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT organization_memberships_validity CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT organization_memberships_job_title_length CHECK (job_title IS NULL OR char_length(job_title) BETWEEN 1 AND 200)
);
ALTER TABLE public.organization_memberships OWNER TO postgres;

-- At most one active membership per user.
CREATE UNIQUE INDEX organization_memberships_one_active
  ON public.organization_memberships (user_id)
  WHERE status = 'active';

CREATE INDEX organization_memberships_org_idx
  ON public.organization_memberships (organization_id, status);

CREATE TRIGGER update_organization_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_membership_active_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_status text;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_org_status
  FROM public.organizations
  WHERE id = NEW.organization_id;

  IF v_org_status IS NULL OR v_org_status <> 'active' THEN
    PERFORM public.raise_business_error('inactive_organization');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_membership_active_organization_trigger
  BEFORE INSERT OR UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_membership_active_organization();

-- ============================================
-- platform_roles, platform_entitlements, role entitlements
-- ============================================

CREATE TABLE IF NOT EXISTS public.platform_roles (
  code text PRIMARY KEY,
  description text NOT NULL
);
ALTER TABLE public.platform_roles OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.platform_entitlements (
  code text PRIMARY KEY,
  description text NOT NULL
);
ALTER TABLE public.platform_entitlements OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.platform_role_entitlements (
  role_code text NOT NULL REFERENCES public.platform_roles(code) ON DELETE CASCADE,
  entitlement_code text NOT NULL REFERENCES public.platform_entitlements(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, entitlement_code)
);
ALTER TABLE public.platform_role_entitlements OWNER TO postgres;

INSERT INTO public.platform_roles (code, description) VALUES
  ('PLATFORM_ADMIN', 'Platform-wide administrator'),
  ('ORG_ADMIN', 'Organization administrator'),
  ('TRADER', 'Trader'),
  ('SALES', 'Sales'),
  ('OPERATIONS', 'Operations'),
  ('COMPLIANCE', 'Compliance'),
  ('VIEWER', 'Read-only viewer')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.platform_entitlements (code, description) VALUES
  ('DIRECTORY_READ', 'Read the trading participant directory'),
  ('CHAT_SEND', 'Send chat messages'),
  ('RFQ_CREATE', 'Create and dispatch RFQs'),
  ('RFQ_RESPOND', 'Respond to RFQs'),
  ('RFQ_COUNTER', 'Counter RFQ responses'),
  ('RFQ_CANCEL', 'Cancel RFQs'),
  ('DEAL_BOOK', 'Book deals'),
  ('DEAL_VIEW', 'View deals'),
  ('TRADE_CONFIRMATION_GENERATE', 'Generate trade confirmations'),
  ('TRADE_CONFIRMATION_ACKNOWLEDGE', 'Acknowledge trade confirmations'),
  ('DOCUMENT_VIEW', 'View documents'),
  ('DOCUMENT_DOWNLOAD', 'Download documents'),
  ('INVENTORY_VIEW', 'View inventory'),
  ('INVENTORY_SYNC', 'Trigger inventory synchronization'),
  ('TRADE_VOLUME_VIEW', 'View trade volume'),
  ('TRADE_VOLUME_IMPORT', 'Import trade volume'),
  ('ORG_MEMBERS_MANAGE', 'Manage organization members'),
  ('ORG_CAPABILITIES_MANAGE', 'Manage organization capabilities')
ON CONFLICT (code) DO NOTHING;

-- Base entitlement matrix.
INSERT INTO public.platform_role_entitlements (role_code, entitlement_code) VALUES
  ('PLATFORM_ADMIN', 'DIRECTORY_READ'),
  ('PLATFORM_ADMIN', 'CHAT_SEND'),
  ('PLATFORM_ADMIN', 'RFQ_CREATE'),
  ('PLATFORM_ADMIN', 'RFQ_RESPOND'),
  ('PLATFORM_ADMIN', 'RFQ_COUNTER'),
  ('PLATFORM_ADMIN', 'RFQ_CANCEL'),
  ('PLATFORM_ADMIN', 'DEAL_BOOK'),
  ('PLATFORM_ADMIN', 'DEAL_VIEW'),
  ('PLATFORM_ADMIN', 'TRADE_CONFIRMATION_GENERATE'),
  ('PLATFORM_ADMIN', 'TRADE_CONFIRMATION_ACKNOWLEDGE'),
  ('PLATFORM_ADMIN', 'DOCUMENT_VIEW'),
  ('PLATFORM_ADMIN', 'DOCUMENT_DOWNLOAD'),
  ('PLATFORM_ADMIN', 'INVENTORY_VIEW'),
  ('PLATFORM_ADMIN', 'INVENTORY_SYNC'),
  ('PLATFORM_ADMIN', 'TRADE_VOLUME_VIEW'),
  ('PLATFORM_ADMIN', 'TRADE_VOLUME_IMPORT'),
  ('PLATFORM_ADMIN', 'ORG_MEMBERS_MANAGE'),
  ('PLATFORM_ADMIN', 'ORG_CAPABILITIES_MANAGE'),
  ('ORG_ADMIN', 'DIRECTORY_READ'),
  ('ORG_ADMIN', 'CHAT_SEND'),
  ('ORG_ADMIN', 'RFQ_CREATE'),
  ('ORG_ADMIN', 'RFQ_RESPOND'),
  ('ORG_ADMIN', 'RFQ_COUNTER'),
  ('ORG_ADMIN', 'RFQ_CANCEL'),
  ('ORG_ADMIN', 'DEAL_BOOK'),
  ('ORG_ADMIN', 'DEAL_VIEW'),
  ('ORG_ADMIN', 'TRADE_CONFIRMATION_GENERATE'),
  ('ORG_ADMIN', 'TRADE_CONFIRMATION_ACKNOWLEDGE'),
  ('ORG_ADMIN', 'DOCUMENT_VIEW'),
  ('ORG_ADMIN', 'DOCUMENT_DOWNLOAD'),
  ('ORG_ADMIN', 'INVENTORY_VIEW'),
  ('ORG_ADMIN', 'TRADE_VOLUME_VIEW'),
  ('ORG_ADMIN', 'ORG_MEMBERS_MANAGE'),
  ('ORG_ADMIN', 'ORG_CAPABILITIES_MANAGE'),
  ('TRADER', 'DIRECTORY_READ'),
  ('TRADER', 'CHAT_SEND'),
  ('TRADER', 'RFQ_CREATE'),
  ('TRADER', 'RFQ_RESPOND'),
  ('TRADER', 'RFQ_COUNTER'),
  ('TRADER', 'RFQ_CANCEL'),
  ('TRADER', 'DEAL_BOOK'),
  ('TRADER', 'DEAL_VIEW'),
  ('TRADER', 'TRADE_CONFIRMATION_GENERATE'),
  ('TRADER', 'TRADE_CONFIRMATION_ACKNOWLEDGE'),
  ('TRADER', 'DOCUMENT_VIEW'),
  ('TRADER', 'DOCUMENT_DOWNLOAD'),
  ('TRADER', 'INVENTORY_VIEW'),
  ('TRADER', 'TRADE_VOLUME_VIEW'),
  ('SALES', 'DIRECTORY_READ'),
  ('SALES', 'CHAT_SEND'),
  ('SALES', 'RFQ_RESPOND'),
  ('SALES', 'RFQ_COUNTER'),
  ('SALES', 'DOCUMENT_VIEW'),
  ('SALES', 'DOCUMENT_DOWNLOAD'),
  ('SALES', 'INVENTORY_VIEW'),
  ('OPERATIONS', 'DIRECTORY_READ'),
  ('OPERATIONS', 'CHAT_SEND'),
  ('OPERATIONS', 'INVENTORY_VIEW'),
  ('OPERATIONS', 'INVENTORY_SYNC'),
  ('OPERATIONS', 'TRADE_VOLUME_VIEW'),
  ('OPERATIONS', 'TRADE_VOLUME_IMPORT'),
  ('OPERATIONS', 'DOCUMENT_VIEW'),
  ('OPERATIONS', 'DOCUMENT_DOWNLOAD'),
  ('COMPLIANCE', 'DIRECTORY_READ'),
  ('COMPLIANCE', 'DOCUMENT_VIEW'),
  ('COMPLIANCE', 'DOCUMENT_DOWNLOAD'),
  ('COMPLIANCE', 'TRADE_VOLUME_VIEW'),
  ('VIEWER', 'DIRECTORY_READ'),
  ('VIEWER', 'DEAL_VIEW'),
  ('VIEWER', 'DOCUMENT_VIEW'),
  ('VIEWER', 'TRADE_VOLUME_VIEW')
ON CONFLICT (role_code, entitlement_code) DO NOTHING;

-- ============================================
-- user_platform_roles
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_platform_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES public.platform_roles(code) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_platform_roles_validity CHECK (valid_until IS NULL OR valid_until > valid_from)
);
ALTER TABLE public.user_platform_roles OWNER TO postgres;

CREATE INDEX user_platform_roles_user_idx
  ON public.user_platform_roles (user_id);

-- ============================================
-- Authorization helpers (internal)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_platform_roles upr
    WHERE upr.user_id = (SELECT auth.uid())
      AND upr.role_code = 'PLATFORM_ADMIN'
      AND (upr.valid_until IS NULL OR upr.valid_until > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_entitlement_for_org(p_code text, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_platform_roles upr
    JOIN public.platform_role_entitlements pre ON pre.role_code = upr.role_code
    WHERE upr.user_id = (SELECT auth.uid())
      AND pre.entitlement_code = p_code
      AND (upr.valid_until IS NULL OR upr.valid_until > now())
      AND (upr.organization_id IS NULL OR upr.organization_id = p_org_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_active_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND o.status = 'active'
      AND (m.valid_until IS NULL OR m.valid_until > now())
  ) THEN
    PERFORM public.raise_business_error('no_active_organization');
  END IF;
END;
$$;

-- ============================================
-- Public read helpers and RPCs
-- ============================================

CREATE OR REPLACE FUNCTION public.current_organization_membership()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'organizationId', o.id,
    'organizationName', o.display_name,
    'primaryUnitId', m.primary_unit_id,
    'jobTitle', m.job_title,
    'status', m.status
  )
  FROM public.organization_memberships m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = (SELECT auth.uid())
    AND m.status = 'active'
    AND (m.valid_until IS NULL OR m.valid_until > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_entitlement(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_platform_roles upr
    JOIN public.platform_role_entitlements pre ON pre.role_code = upr.role_code
    JOIN public.organization_memberships m ON m.user_id = upr.user_id AND m.status = 'active'
    JOIN public.organizations o ON o.id = m.organization_id AND o.status = 'active'
    WHERE upr.user_id = (SELECT auth.uid())
      AND pre.entitlement_code = p_code
      AND (upr.valid_until IS NULL OR upr.valid_until > now())
      AND (m.valid_until IS NULL OR m.valid_until > now())
      AND (upr.organization_id IS NULL OR upr.organization_id = m.organization_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.organization_has_capability(p_org_id uuid, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_capabilities oc
    WHERE oc.organization_id = p_org_id
      AND oc.capability_code = p_code
      AND oc.status = 'active'
      AND (oc.valid_until IS NULL OR oc.valid_until > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_trading_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_membership jsonb;
  v_org_id uuid;
  v_capabilities jsonb;
  v_entitlements jsonb;
  v_flags jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'userId', NULL,
      'membership', NULL,
      'capabilities', '[]'::jsonb,
      'entitlements', '[]'::jsonb,
      'flags', '{}'::jsonb
    );
  END IF;

  v_membership := public.current_organization_membership();
  v_org_id := (v_membership->>'organizationId')::uuid;

  SELECT COALESCE(
    jsonb_agg(oc.capability_code ORDER BY oc.capability_code),
    '[]'::jsonb
  ) INTO v_capabilities
  FROM public.organization_capabilities oc
  WHERE oc.organization_id = v_org_id
    AND oc.status = 'active'
    AND (oc.valid_until IS NULL OR oc.valid_until > now());

  SELECT COALESCE(
    jsonb_agg(DISTINCT pre.entitlement_code ORDER BY pre.entitlement_code),
    '[]'::jsonb
  ) INTO v_entitlements
  FROM public.user_platform_roles upr
  JOIN public.platform_role_entitlements pre ON pre.role_code = upr.role_code
  WHERE upr.user_id = v_uid
    AND (upr.valid_until IS NULL OR upr.valid_until > now())
    AND (upr.organization_id IS NULL OR upr.organization_id = v_org_id);

  SELECT COALESCE(
    jsonb_object_agg(ff.key, ff.enabled),
    '{}'::jsonb
  ) INTO v_flags
  FROM public.feature_flags ff;

  RETURN jsonb_build_object(
    'userId', v_uid,
    'membership', v_membership,
    'capabilities', v_capabilities,
    'entitlements', v_entitlements,
    'flags', v_flags
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_trading_participants()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'userId', m.user_id,
        'displayName', public.display_name_for_user(m.user_id),
        'organizationId', o.id,
        'organizationName', o.display_name,
        'jobTitle', m.job_title,
        'capabilities', COALESCE(c.caps, '[]'::jsonb)
      )
      ORDER BY lower(public.display_name_for_user(m.user_id))
    ),
    '[]'::jsonb
  )
  FROM public.organization_memberships m
  JOIN public.organizations o ON o.id = m.organization_id AND o.status = 'active'
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(oc.capability_code ORDER BY oc.capability_code) AS caps
    FROM public.organization_capabilities oc
    WHERE oc.organization_id = o.id
      AND oc.status = 'active'
      AND (oc.valid_until IS NULL OR oc.valid_until > now())
  ) c ON true
  WHERE m.status = 'active'
    AND (m.valid_until IS NULL OR m.valid_until > now())
    AND m.user_id <> (SELECT auth.uid());
$$;

-- ============================================
-- Admin RPCs
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_list_organizations()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
  v_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  v_is_admin := public.is_platform_admin();
  IF NOT v_is_admin AND NOT public.has_entitlement('ORG_CAPABILITIES_MANAGE') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  v_org_id := CASE
    WHEN v_is_admin THEN NULL
    ELSE (public.current_organization_membership()->>'organizationId')::uuid
  END;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'legalName', o.legal_name,
          'displayName', o.display_name,
          'status', o.status,
          'jurisdictionCountryCode', o.jurisdiction_country_code,
          'capabilities', COALESCE(c.caps, '[]'::jsonb),
          'memberCount', COALESCE(mc.cnt, 0)
        )
        ORDER BY lower(o.display_name)
      )
      FROM public.organizations o
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object('code', oc.capability_code, 'status', oc.status)
          ORDER BY oc.capability_code
        ) AS caps
        FROM public.organization_capabilities oc
        WHERE oc.organization_id = o.id AND oc.status = 'active'
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS cnt
        FROM public.organization_memberships mm
        WHERE mm.organization_id = o.id AND mm.status = 'active'
      ) mc ON true
      WHERE (v_org_id IS NULL OR o.id = v_org_id)
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_organization(
  p_legal_name text,
  p_display_name text,
  p_registration_number text,
  p_lei text,
  p_jurisdiction_country_code text,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_legal_name text;
  v_display_name text;
  v_lei text;
  v_jurisdiction text;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;
  IF NOT public.is_platform_admin() THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  v_legal_name := trim(p_legal_name);
  v_display_name := trim(p_display_name);
  IF v_legal_name IS NULL OR char_length(v_legal_name) NOT BETWEEN 1 AND 300 THEN
    PERFORM public.raise_business_error('invalid_organization');
  END IF;
  IF v_display_name IS NULL OR char_length(v_display_name) NOT BETWEEN 1 AND 160 THEN
    PERFORM public.raise_business_error('invalid_organization');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'active', 'suspended', 'inactive') THEN
    PERFORM public.raise_business_error('invalid_organization');
  END IF;

  v_jurisdiction := upper(trim(p_jurisdiction_country_code));
  IF v_jurisdiction = '' THEN
    v_jurisdiction := NULL;
  END IF;
  IF v_jurisdiction IS NOT NULL AND v_jurisdiction !~ '^[A-Z][A-Z]$' THEN
    PERFORM public.raise_business_error('invalid_organization');
  END IF;

  v_lei := NULLIF(trim(p_lei), '');
  IF v_lei IS NOT NULL AND v_lei !~ '^[0-9A-Z]{20}$' THEN
    PERFORM public.raise_business_error('invalid_organization');
  END IF;

  INSERT INTO public.organizations (
    legal_name, display_name, registration_number, lei,
    jurisdiction_country_code, status, source_system
  )
  VALUES (
    v_legal_name, v_display_name, NULLIF(trim(p_registration_number), ''),
    v_lei, v_jurisdiction, p_status, 'xchat'
  )
  RETURNING id INTO v_org_id;

  RETURN jsonb_build_object(
    'id', v_org_id,
    'legalName', v_legal_name,
    'displayName', v_display_name,
    'status', p_status,
    'jurisdictionCountryCode', v_jurisdiction
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_organization_capability(
  p_organization_id uuid,
  p_capability_code text,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;
  IF NOT public.is_platform_admin()
     AND NOT public.has_entitlement_for_org('ORG_CAPABILITIES_MANAGE', p_organization_id) THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF p_capability_code IS NULL OR p_capability_code NOT IN (
    'MINE_OPERATOR', 'CPP', 'REFINER', 'TRADER', 'DEALER', 'BANK', 'VAULT',
    'FABRICATOR', 'MINT', 'LOGISTICS_PROVIDER', 'INVESTOR', 'AUDITOR', 'OTHER'
  ) THEN
    PERFORM public.raise_business_error('invalid_capability_code');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'inactive') THEN
    PERFORM public.raise_business_error('invalid_capability');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id) THEN
    PERFORM public.raise_business_error('organization_not_found');
  END IF;

  UPDATE public.organization_capabilities
  SET status = 'inactive'
  WHERE organization_id = p_organization_id
    AND capability_code = p_capability_code
    AND status = 'active';

  IF p_status = 'active' THEN
    INSERT INTO public.organization_capabilities (organization_id, capability_code, status, valid_from)
    VALUES (p_organization_id, p_capability_code, 'active', now());
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organizationId', p_organization_id,
    'capabilityCode', p_capability_code,
    'status', p_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_organization_unit(
  p_organization_id uuid,
  p_parent_unit_id uuid,
  p_unit_type text,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit_id uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;
  IF NOT public.is_platform_admin()
     AND NOT public.has_entitlement_for_org('ORG_CAPABILITIES_MANAGE', p_organization_id) THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF p_unit_type IS NULL OR p_unit_type NOT IN ('department', 'desk', 'site') THEN
    PERFORM public.raise_business_error('invalid_unit_type');
  END IF;
  v_name := trim(p_name);
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 200 THEN
    PERFORM public.raise_business_error('invalid_unit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id) THEN
    PERFORM public.raise_business_error('organization_not_found');
  END IF;

  INSERT INTO public.organization_units (organization_id, parent_unit_id, unit_type, name)
  VALUES (p_organization_id, p_parent_unit_id, p_unit_type, v_name)
  RETURNING id INTO v_unit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'unitId', v_unit_id,
    'organizationId', p_organization_id,
    'unitType', p_unit_type,
    'name', v_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_membership(
  p_user_id uuid,
  p_organization_id uuid,
  p_primary_unit_id uuid,
  p_job_title text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;
  IF NOT public.is_platform_admin()
     AND NOT public.has_entitlement_for_org('ORG_MEMBERS_MANAGE', p_organization_id) THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    PERFORM public.raise_business_error('user_not_found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id AND o.status = 'active'
  ) THEN
    PERFORM public.raise_business_error('inactive_organization');
  END IF;

  v_job_title := NULLIF(trim(p_job_title), '');
  IF v_job_title IS NOT NULL AND char_length(v_job_title) > 200 THEN
    PERFORM public.raise_business_error('invalid_membership');
  END IF;

  UPDATE public.organization_memberships
  SET status = 'inactive', valid_until = now(), updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  INSERT INTO public.organization_memberships (
    user_id, organization_id, primary_unit_id, job_title, status, valid_from
  )
  VALUES (p_user_id, p_organization_id, p_primary_unit_id, v_job_title, 'active', now());

  RETURN jsonb_build_object('ok', true, 'userId', p_user_id, 'organizationId', p_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_user_role(
  p_user_id uuid,
  p_role_code text,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;
  IF NOT public.is_platform_admin()
     AND NOT public.has_entitlement_for_org('ORG_MEMBERS_MANAGE', p_organization_id) THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    PERFORM public.raise_business_error('user_not_found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_roles r WHERE r.code = p_role_code) THEN
    PERFORM public.raise_business_error('invalid_role_code');
  END IF;
  IF p_organization_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id) THEN
    PERFORM public.raise_business_error('organization_not_found');
  END IF;

  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES (p_user_id, p_role_code, p_organization_id, now());

  RETURN jsonb_build_object('ok', true, 'userId', p_user_id, 'roleCode', p_role_code, 'organizationId', p_organization_id);
END;
$$;

-- ============================================
-- RLS and grants
-- ============================================

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_role_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_platform_roles ENABLE ROW LEVEL SECURITY;

-- No direct table grants for clients: all access goes through SECURITY DEFINER
-- RPCs. Explicitly revoke any default privileges as defense in depth.
REVOKE ALL ON public.feature_flags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organization_capabilities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organization_units FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organization_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_entitlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_role_entitlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_platform_roles FROM PUBLIC, anon, authenticated;

-- Public RPCs
GRANT EXECUTE ON FUNCTION public.current_organization_membership() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_organization_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_entitlement(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_entitlement(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organization_has_capability(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.organization_has_capability(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_trading_context() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_trading_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_trading_participants() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_trading_participants() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_organizations() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_organization(text, text, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_organization(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_capability(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_organization_capability(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_organization_unit(uuid, uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_organization_unit(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_membership(uuid, uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_assign_membership(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_role(uuid, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_assign_user_role(uuid, text, uuid) FROM PUBLIC, anon;

-- Internal helpers must never be callable by clients.
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_entitlement_for_org(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_active_user() FROM PUBLIC, anon, authenticated;
