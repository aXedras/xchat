-- ============================================
-- View for Supply Filtering
-- Always up-to-date view for supply table with aggregated element data
-- ============================================

-- Create regular view (always current, no refresh needed)
CREATE OR REPLACE VIEW public.supply_filter_view with (security_invoker = on) AS
SELECT 
  s.id,
  s.external_supply_id,
  s.scan_date,
  s.external_reference_id,
  s.declared_origin_id,
  s.predicted_origin_id,
  s.confidence_score AS confidence,
  s.notes,
  s.created_at,
  s.updated_at,
  -- Join origin codes for faster filtering (code is NOT NULL, name can be NULL)
  declared_origin.code AS declared_origin_code,
  declared_origin.name AS declared_origin_name,
  predicted_origin.code AS predicted_origin_code,
  predicted_origin.name AS predicted_origin_name,
  -- Pre-aggregate element data for filtering
  jsonb_object_agg(
    COALESCE(e.symbol, 'unknown'),
    jsonb_build_object(
      'concentration', se.concentration,
      'unit', mu.symbol,
      'unit_name', mu.name,
      'status', ms.name,
      'status_description', ms.description
    )
  ) FILTER (WHERE e.symbol IS NOT NULL) AS elements
FROM 
  public.supply s
  LEFT JOIN public.origins declared_origin ON s.declared_origin_id = declared_origin.id
  LEFT JOIN public.origins predicted_origin ON s.predicted_origin_id = predicted_origin.id
  LEFT JOIN public.supply_elements se ON s.id = se.supply_id
  LEFT JOIN public.elements e ON se.element_id = e.id
  LEFT JOIN public.measurement_units mu ON se.unit_id = mu.id
  LEFT JOIN public.measurement_status ms ON se.status_id = ms.id
GROUP BY 
  s.id,
  s.external_supply_id,
  s.scan_date,
  s.external_reference_id,
  s.declared_origin_id,
  s.predicted_origin_id,
  s.confidence_score,
  s.notes,
  s.created_at,
  s.updated_at,
  declared_origin.code,
  declared_origin.name,
  predicted_origin.code,
  predicted_origin.name;
-- Add comment
COMMENT ON VIEW public.supply_filter_view IS 
  'Always up-to-date view for supply filtering with origin codes and aggregated element data';
CREATE OR REPLACE VIEW supply_origin_lookup AS
SELECT 
  lookup_id,
  o_id_map.declared_origin_code,
  origins.id AS origin_id,
  origins.name AS origin_name
FROM origin_id_mapping o_id_map
JOIN origins ON o_id_map.declared_origin_code = origins.code
CROSS JOIN LATERAL (
  VALUES
    (o_id_map.external_id),
    (o_id_map.alternate_id),
    (o_id_map.batch)
) v(lookup_id)
WHERE lookup_id IS NOT NULL;
