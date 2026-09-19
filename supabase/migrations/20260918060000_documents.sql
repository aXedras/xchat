-- ============================================
-- Document storage, access grants and generation jobs (Phase 10)
-- ============================================

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  schema_version integer NOT NULL DEFAULT 1,
  transaction_type text,
  locale text NOT NULL DEFAULT 'en',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_type_check CHECK (
    document_type IN ('rfq_summary', 'quotation', 'trade_confirmation')
  ),
  CONSTRAINT documents_status_check CHECK (
    status IN ('draft', 'generation_pending', 'generated', 'sent', 'failed')
  )
);
ALTER TABLE public.documents OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  version_no integer NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  template_id text NOT NULL,
  template_version text NOT NULL,
  renderer_version text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  input_snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_versions_unique UNIQUE (document_id, version_no),
  CONSTRAINT document_versions_version_check CHECK (version_no > 0),
  CONSTRAINT document_versions_size_check CHECK (size_bytes >= 0)
);
ALTER TABLE public.document_versions OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.document_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_tags_unique UNIQUE (document_id, key, value)
);
ALTER TABLE public.document_tags OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.document_access_grants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  grantee_type text NOT NULL,
  grantee_id uuid NOT NULL,
  rights jsonb NOT NULL DEFAULT '["view"]'::jsonb,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_access_grants_type_check CHECK (grantee_type IN ('organization', 'user')),
  CONSTRAINT document_access_grants_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from)
);
ALTER TABLE public.document_access_grants OWNER TO postgres;

CREATE INDEX IF NOT EXISTS document_access_grants_doc_idx ON public.document_access_grants (document_id);

CREATE TABLE IF NOT EXISTS public.document_generation_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE RESTRICT,
  job_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_code text,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_generation_jobs_unique UNIQUE (job_key),
  CONSTRAINT document_generation_jobs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'dead_letter')
  )
);
ALTER TABLE public.document_generation_jobs OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.document_events (
  id bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_events_type_check CHECK (
    event_type IN ('viewed', 'downloaded', 'sent', 'acknowledged', 'generated', 'generation_failed')
  )
);
ALTER TABLE public.document_events OWNER TO postgres;

CREATE INDEX IF NOT EXISTS document_events_doc_idx ON public.document_events (document_id, id);

-- ============================================
-- Grant check helper and RPCs
-- ============================================

CREATE OR REPLACE FUNCTION public.has_document_grant(p_document_id uuid, p_right text)
RETURNS boolean
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
  IF v_uid IS NULL THEN RETURN false; END IF;
  v_org_id := (public.current_organization_membership()->>'organizationId')::uuid;

  RETURN EXISTS (
    SELECT 1 FROM public.document_access_grants g
    WHERE g.document_id = p_document_id
      AND (g.valid_until IS NULL OR g.valid_until > now())
      AND g.rights ? p_right
      AND (
        (g.grantee_type = 'user' AND g.grantee_id = v_uid)
        OR (g.grantee_type = 'organization' AND g.grantee_id = v_org_id)
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_document_projection(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_document public.documents;
  v_versions jsonb;
  v_tags jsonb;
BEGIN
  IF auth.uid() IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF NOT public.has_document_grant(p_document_id, 'view') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id;
  IF v_document IS NULL THEN PERFORM public.raise_business_error('document_not_found'); END IF;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'versionNo', v.version_no,
      'mimeType', v.mime_type,
      'sizeBytes', v.size_bytes,
      'sha256', v.sha256,
      'templateId', v.template_id,
      'templateVersion', v.template_version,
      'locale', v.locale,
      'createdAt', v.created_at
    ) ORDER BY v.version_no DESC),
    '[]'::jsonb
  ) INTO v_versions
  FROM public.document_versions v
  WHERE v.document_id = p_document_id;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('key', t.key, 'value', t.value) ORDER BY t.key),
    '[]'::jsonb
  ) INTO v_tags
  FROM public.document_tags t
  WHERE t.document_id = p_document_id;

  RETURN jsonb_build_object(
    'id', v_document.id,
    'documentType', v_document.document_type,
    'status', v_document.status,
    'schemaVersion', v_document.schema_version,
    'transactionType', v_document.transaction_type,
    'locale', v_document.locale,
    'createdAt', v_document.created_at,
    'versions', v_versions,
    'tags', v_tags
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_document(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_document public.documents;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN PERFORM public.raise_business_error('unauthenticated'); END IF;
  IF NOT public.has_document_grant(p_document_id, 'view') THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF v_document IS NULL THEN PERFORM public.raise_business_error('document_not_found'); END IF;

  INSERT INTO public.document_events (document_id, actor_user_id, event_type)
  VALUES (p_document_id, v_uid, 'acknowledged');

  RETURN jsonb_build_object('ok', true, 'documentId', p_document_id);
END;
$$;

-- ============================================
-- RLS and grants
-- ============================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.document_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.document_tags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.document_access_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.document_generation_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.document_events FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_document_grant(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_document_grant(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_document_projection(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_document_projection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_document(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.acknowledge_document(uuid) FROM PUBLIC, anon;
