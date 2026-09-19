-- ============================================
-- Document worker RPCs (Phase 10)
-- Service-role only: invoked by the document-worker, never by clients.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_document_generation_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.document_generation_jobs;
BEGIN
  SELECT * INTO v_job
  FROM public.document_generation_jobs
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.document_generation_jobs
  SET status = 'running', updated_at = now()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'documentId', v_job.document_id,
    'jobKey', v_job.job_key,
    'inputSnapshot', v_job.input_snapshot,
    'payloadHash', v_job.payload_hash,
    'correlationId', v_job.correlation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_document_generation_job(
  p_job_id uuid,
  p_storage_path text,
  p_sha256 text,
  p_mime_type text,
  p_size_bytes bigint,
  p_template_id text,
  p_template_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.document_generation_jobs;
  v_version_no integer;
BEGIN
  SELECT * INTO v_job FROM public.document_generation_jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job IS NULL THEN PERFORM public.raise_business_error('job_not_found'); END IF;
  IF v_job.document_id IS NULL THEN PERFORM public.raise_business_error('invalid_job'); END IF;

  SELECT COALESCE(max(version_no), 0) + 1 INTO v_version_no
  FROM public.document_versions
  WHERE document_id = v_job.document_id;

  INSERT INTO public.document_versions (
    document_id, version_no, storage_path, sha256, mime_type, size_bytes,
    template_id, template_version, renderer_version, locale, input_snapshot_hash
  )
  VALUES (
    v_job.document_id, v_version_no, p_storage_path, p_sha256, p_mime_type,
    p_size_bytes, p_template_id, p_template_version, 'typst', 'en', v_job.payload_hash
  );

  UPDATE public.document_generation_jobs
  SET status = 'completed', updated_at = now()
  WHERE id = p_job_id;

  UPDATE public.documents
  SET status = 'generated', updated_at = now()
  WHERE id = v_job.document_id;

  INSERT INTO public.document_events (document_id, actor_user_id, event_type, event_payload)
  VALUES (v_job.document_id, auth.uid(), 'generated', jsonb_build_object('versionNo', v_version_no));

  RETURN jsonb_build_object('ok', true, 'documentId', v_job.document_id, 'versionNo', v_version_no);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_document_generation_job(
  p_job_id uuid,
  p_error_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.document_generation_jobs;
  v_next_status text;
BEGIN
  SELECT * INTO v_job FROM public.document_generation_jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job IS NULL THEN PERFORM public.raise_business_error('job_not_found'); END IF;

  v_next_status := CASE
    WHEN v_job.retry_count + 1 >= v_job.max_attempts THEN 'dead_letter'
    ELSE 'pending'
  END;

  UPDATE public.document_generation_jobs
  SET status = v_next_status,
      retry_count = retry_count + 1,
      error_code = p_error_code,
      updated_at = now()
  WHERE id = p_job_id;

  IF v_next_status = 'dead_letter' AND v_job.document_id IS NOT NULL THEN
    UPDATE public.documents SET status = 'failed', updated_at = now() WHERE id = v_job.document_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_next_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_document_generation_job() TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_document_generation_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_document_generation_job(uuid, text, text, text, bigint, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_document_generation_job(uuid, text, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_document_generation_job(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.fail_document_generation_job(uuid, text) FROM PUBLIC, anon, authenticated;
