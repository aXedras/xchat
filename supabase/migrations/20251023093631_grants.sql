-- Temporarily disable RLS to test, then re-enable with proper GRANT
-- This ensures the authenticated role has the necessary table permissions

-- Grant all privileges on tables to authenticated role
GRANT ALL ON public.elements TO authenticated;
GRANT ALL ON public.element_categories TO authenticated;
GRANT ALL ON public.element_category_map TO authenticated;
GRANT ALL ON public.origins TO authenticated;
GRANT ALL ON public.supply TO authenticated;
GRANT ALL ON public.supply_elements TO authenticated;
GRANT ALL ON public.measurement_status TO authenticated;
GRANT ALL ON public.measurement_units TO authenticated;
GRANT ALL ON public.system_settings TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.profile TO authenticated;
GRANT ALL ON public.customers TO authenticated;
GRANT ALL ON public.customer_origins TO authenticated;
GRANT ALL ON public.origin_id_mapping TO authenticated;
GRANT ALL ON public.alert_channels TO authenticated;
GRANT ALL ON public.alert_conditions TO authenticated;
GRANT ALL ON public.alert_condition_channels TO authenticated;
GRANT ALL ON public.alert_logs TO authenticated;
GRANT ALL ON public.models TO authenticated;
GRANT ALL ON public.prediction_results TO authenticated;
GRANT ALL ON public.country TO authenticated;
GRANT ALL ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversation_members TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT ALL ON public.quote_requests TO authenticated;
GRANT ALL ON public.quote_responses TO authenticated;
GRANT ALL ON public.trade_deals TO authenticated;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_customer_elements(UUID) TO authenticated;
COMMENT ON FUNCTION public.get_customer_elements IS 'Returns distinct element symbols for all supplies linked to a customer via customer_origins';
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_customer_supply_count(UUID) TO authenticated;
COMMENT ON FUNCTION public.get_customer_supply_count IS 'Returns count of supply samples for a customer via customer_origins';
-- Grant access
GRANT SELECT ON public.supply_filter_view TO authenticated;
GRANT SELECT ON public.supply_filter_view TO anon;
-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_supply_by_origin(uuid) TO authenticated;
-- Grant execute permissions to authenticated users
-- (functions will check internally for vendor role)
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
-- RBAC Grants
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country TO anon;
-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_origins_for_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_origins_for_customer(UUID) TO anon;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_origin_id_mappings_batch(UUID[]) TO authenticated;
-- Grant SELECT on supply_origin_lookup view
GRANT SELECT ON public.supply_origin_lookup TO authenticated;
COMMENT ON VIEW public.supply_origin_lookup IS 'Lookup view for mapping external IDs to origin IDs via origin_id_mapping and origins tables';
-- Grant SELECT to authenticated users (can view jobs)
GRANT SELECT ON public.auto_prediction_jobs TO authenticated;
-- Grant INSERT to authenticated users (can create jobs)
GRANT INSERT ON public.auto_prediction_jobs TO authenticated;
-- Grant UPDATE to authenticated users (can update job progress)
GRANT UPDATE ON public.auto_prediction_jobs TO authenticated;
-- Grant SELECT to anon role (for public read access if needed)
-- Note: RLS policies will still enforce row-level security
GRANT SELECT ON public.auto_prediction_jobs TO anon;
