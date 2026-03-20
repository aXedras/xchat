-- ============================================
-- Delete Origins Cascade RPC Function
-- Provides efficient batch delete for origins with cascade
-- Avoids HTTP 414 (URL too long) errors with many IDs
-- ============================================

-- ============================================
-- Delete Origins with Cascade
-- ============================================
-- This function accepts an array of UUIDs and deletes origins
-- PostgreSQL FKs handle cascade automatically (ON DELETE CASCADE)
-- Returns the count of deleted origins

CREATE OR REPLACE FUNCTION public.delete_origins_cascade(origin_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete origins - PostgreSQL CASCADE handles dependent data
  DELETE FROM origins
  WHERE id = ANY(origin_ids);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
COMMENT ON FUNCTION public.delete_origins_cascade(uuid[]) IS 
  'Delete origins by array of IDs. PostgreSQL CASCADE handles dependent data (origin_id_mapping, customer_origins, etc.). Uses POST body instead of URL params to avoid HTTP 414 errors.';
-- ============================================
-- Grants for authenticated users
-- ============================================
GRANT EXECUTE ON FUNCTION public.delete_origins_cascade(uuid[]) TO authenticated;
