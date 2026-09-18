-- Grants for the authenticated role on xChat tables and RPCs.

-- Table grants
GRANT ALL ON public.system_settings TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.profile TO authenticated;

-- Role lookup
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;

-- Closed-Group Messaging read RPCs (M6)
GRANT EXECUTE ON FUNCTION public.list_participants() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_participants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_conversations() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_messages(uuid, timestamptz, uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_messages(uuid, timestamptz, uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dispatch(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_dispatch(uuid) FROM PUBLIC, anon;

-- RFQ read RPCs (M8)
GRANT EXECUTE ON FUNCTION public.list_quote_invitations() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_quote_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_quote_responses(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_quote_responses(uuid) FROM PUBLIC, anon;

-- send_messages mutation RPC (M9)
GRANT EXECUTE ON FUNCTION public.send_messages(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.send_messages(jsonb) FROM PUBLIC, anon;

-- RFQ mutation RPCs (M9a)
GRANT EXECUTE ON FUNCTION public.submit_quote_response(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_quote_response(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.counter_quote_response(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.counter_quote_response(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_quote_response(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_quote_response(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_quote_response(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.book_quote_response(jsonb) FROM PUBLIC, anon;

-- Internal helpers must never be callable by clients. They run with the
-- privileges of the calling SECURITY DEFINER function, not the browser role.
REVOKE ALL ON FUNCTION public.resolve_bilateral_conversation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_workflow_message(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.display_name_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.organization_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.effective_quote_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.raise_business_error(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_rfq_terms(jsonb) FROM PUBLIC, anon, authenticated;

-- Admin user-management RPCs (vendor-role checked internally)
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
