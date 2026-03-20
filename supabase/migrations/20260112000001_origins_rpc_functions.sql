-- ============================================
-- Origins RPC Functions
-- Provides efficient batch operations for origins
-- ============================================

-- ============================================
-- 1. Get Origins by IDs (replaces URL-based .in() queries)
-- ============================================
-- This function accepts an array of UUIDs and returns full origin data
-- with country join. Avoids HTTP 414 (URL too long) errors.

CREATE OR REPLACE FUNCTION public.get_origins_by_ids(origin_ids uuid[])
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  status public.origin_status,
  country_id uuid,
  country_code text,
  country_iso2_code text,
  country_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT 
    o.id,
    o.code,
    o.name,
    o.status,
    o.country_id,
    c.code AS country_code,
    c.iso2_code AS country_iso2_code,
    c.name AS country_name,
    o.created_at,
    o.updated_at
  FROM origins o
  LEFT JOIN country c ON c.id = o.country_id
  WHERE o.id = ANY(origin_ids)
  ORDER BY o.code;
$$;
COMMENT ON FUNCTION public.get_origins_by_ids(uuid[]) IS 
  'Fetch origins by array of IDs with country data. Uses POST body instead of URL params to avoid HTTP 414 errors.';
-- ============================================
-- 2. Update Origins Status (bulk activate/deactivate)
-- ============================================
-- Returns the number of updated rows

CREATE OR REPLACE FUNCTION public.update_origins_status(
  origin_ids uuid[],
  new_status public.origin_status
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE origins
  SET 
    status = new_status,
    updated_at = now()
  WHERE id = ANY(origin_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
COMMENT ON FUNCTION public.update_origins_status(uuid[], public.origin_status) IS 
  'Bulk update status (active/inactive) for multiple origins. Returns count of updated rows.';
-- ============================================
-- 3. Get Supply IDs with Active Origins
-- ============================================
-- Filters supply_ids to only those with active declared_origin
-- Used by auto-prediction to skip supplies with inactive origins

CREATE OR REPLACE FUNCTION public.get_supply_ids_with_active_origins(supply_ids uuid[])
RETURNS TABLE (supply_id uuid)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT s.id AS supply_id
  FROM supply s
  INNER JOIN origins o ON o.id = s.declared_origin_id
  WHERE s.id = ANY(supply_ids)
    AND o.status = 'active';
$$;
COMMENT ON FUNCTION public.get_supply_ids_with_active_origins(uuid[]) IS 
  'Filter supply IDs to only those with active declared origins. Uses POST body to avoid HTTP 414 errors.';
-- ============================================
-- Grants for authenticated users
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_origins_by_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_origins_status(uuid[], public.origin_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supply_ids_with_active_origins(uuid[]) TO authenticated;
