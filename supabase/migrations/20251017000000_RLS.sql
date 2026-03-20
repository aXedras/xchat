-- ============================================
-- Row Level Security (RLS) Policies
-- Simple authenticated access for all tables
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.element_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.element_category_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origin_id_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_condition_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_prediction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_deals ENABLE ROW LEVEL SECURITY;
-- Create simple authenticated access policies for all tables
-- Note: No DROP statements needed as this is a clean migration
CREATE POLICY "Authenticated full access" ON public.profile
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.user_roles
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.origins
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.elements
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.element_categories
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.element_category_map
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.supply
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.supply_elements
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.measurement_status
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.measurement_units
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.customers
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.customer_origins
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.origin_id_mapping
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.alert_channels
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.alert_conditions
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.alert_condition_channels
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.alert_logs
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.system_settings
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.models
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated full access" ON public.country
  FOR ALL USING (auth.uid() IS NOT NULL);
-- RLS Policies
CREATE POLICY "Allow authenticated users to read prediction results"
  ON public.prediction_results
  FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Allow authenticated users to insert prediction results"
  ON public.prediction_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete prediction results"
  ON public.prediction_results
  FOR DELETE
  TO authenticated
  USING (true);
-- 5. RLS Policies for permissions (read-only for authenticated users)
CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view role_permissions"
  ON public.role_permissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
-- RLS Policy: Authenticated users can view all jobs
CREATE POLICY "Authenticated users can view auto prediction jobs"
  ON public.auto_prediction_jobs
  FOR SELECT
  TO authenticated
  USING (true);
-- RLS Policy: Authenticated users can create jobs
CREATE POLICY "Authenticated users can create auto prediction jobs"
  ON public.auto_prediction_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
-- RLS Policy: Authenticated users can update all jobs
-- (Jobs are system-level background tasks, any authenticated user should be able to update progress)
CREATE POLICY "Authenticated users can update auto prediction jobs"
  ON public.auto_prediction_jobs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
-- RLS Policy: Service role has full access (for admin operations)
CREATE POLICY "Service role can manage auto prediction jobs"
  ON public.auto_prediction_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated members can read chat conversations"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_members members
      WHERE members.conversation_id = chat_conversations.id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated owners can insert chat conversations"
  ON public.chat_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (lower(created_by_email) = public.current_member_email());
CREATE POLICY "Authenticated owners can update chat conversations"
  ON public.chat_conversations
  FOR UPDATE
  TO authenticated
  USING (lower(created_by_email) = public.current_member_email())
  WITH CHECK (lower(created_by_email) = public.current_member_email());
CREATE POLICY "Authenticated owners can delete chat conversations"
  ON public.chat_conversations
  FOR DELETE
  TO authenticated
  USING (lower(created_by_email) = public.current_member_email());

CREATE POLICY "Authenticated members can read chat conversation members"
  ON public.chat_conversation_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_members viewer
      WHERE viewer.conversation_id = chat_conversation_members.conversation_id
        AND lower(viewer.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated owners can insert chat conversation members"
  ON public.chat_conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations conversations
      WHERE conversations.id = chat_conversation_members.conversation_id
        AND lower(conversations.created_by_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated owners can update chat conversation members"
  ON public.chat_conversation_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations conversations
      WHERE conversations.id = chat_conversation_members.conversation_id
        AND lower(conversations.created_by_email) = public.current_member_email()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations conversations
      WHERE conversations.id = chat_conversation_members.conversation_id
        AND lower(conversations.created_by_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated owners can delete chat conversation members"
  ON public.chat_conversation_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations conversations
      WHERE conversations.id = chat_conversation_members.conversation_id
        AND lower(conversations.created_by_email) = public.current_member_email()
    )
  );

CREATE POLICY "Authenticated members can read chat messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_members members
      WHERE members.conversation_id = chat_messages.chat_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated members can insert own chat messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lower(sender_email) = public.current_member_email()
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversation_members members
      WHERE members.conversation_id = chat_messages.chat_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated senders can update own chat messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (lower(sender_email) = public.current_member_email())
  WITH CHECK (lower(sender_email) = public.current_member_email());
CREATE POLICY "Authenticated senders can delete own chat messages"
  ON public.chat_messages
  FOR DELETE
  TO authenticated
  USING (lower(sender_email) = public.current_member_email());

CREATE POLICY "Authenticated members can read quote requests"
  ON public.quote_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_members members
      WHERE members.conversation_id = quote_requests.chat_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated members can insert own quote requests"
  ON public.quote_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lower(requested_by_email) = public.current_member_email()
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversation_members members
      WHERE members.conversation_id = quote_requests.chat_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated requesters can update own quote requests"
  ON public.quote_requests
  FOR UPDATE
  TO authenticated
  USING (lower(requested_by_email) = public.current_member_email())
  WITH CHECK (lower(requested_by_email) = public.current_member_email());
CREATE POLICY "Authenticated requesters can delete own quote requests"
  ON public.quote_requests
  FOR DELETE
  TO authenticated
  USING (lower(requested_by_email) = public.current_member_email());

CREATE POLICY "Authenticated members can read quote responses"
  ON public.quote_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_requests requests
      JOIN public.chat_conversation_members members ON members.conversation_id = requests.chat_id
      WHERE requests.id = quote_responses.request_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated members can insert own quote responses"
  ON public.quote_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lower(responder_email) = public.current_member_email()
    AND EXISTS (
      SELECT 1
      FROM public.quote_requests requests
      JOIN public.chat_conversation_members members ON members.conversation_id = requests.chat_id
      WHERE requests.id = quote_responses.request_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated responders can update own quote responses"
  ON public.quote_responses
  FOR UPDATE
  TO authenticated
  USING (lower(responder_email) = public.current_member_email())
  WITH CHECK (
    lower(responder_email) = public.current_member_email()
    AND EXISTS (
      SELECT 1
      FROM public.quote_requests requests
      JOIN public.chat_conversation_members members ON members.conversation_id = requests.chat_id
      WHERE requests.id = quote_responses.request_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated responders can delete own quote responses"
  ON public.quote_responses
  FOR DELETE
  TO authenticated
  USING (lower(responder_email) = public.current_member_email());

CREATE POLICY "Authenticated members can read trade deals"
  ON public.trade_deals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_requests requests
      JOIN public.chat_conversation_members members ON members.conversation_id = requests.chat_id
      WHERE requests.id = trade_deals.request_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated members can insert trade deals"
  ON public.trade_deals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quote_requests requests
      JOIN public.chat_conversation_members members ON members.conversation_id = requests.chat_id
      WHERE requests.id = trade_deals.request_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated bookers can update trade deals"
  ON public.trade_deals
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE(lower(booked_by_email), public.current_member_email()) = public.current_member_email()
  )
  WITH CHECK (
    COALESCE(lower(booked_by_email), public.current_member_email()) = public.current_member_email()
    AND EXISTS (
      SELECT 1
      FROM public.quote_requests requests
      JOIN public.chat_conversation_members members ON members.conversation_id = requests.chat_id
      WHERE requests.id = trade_deals.request_id
        AND lower(members.member_email) = public.current_member_email()
    )
  );
CREATE POLICY "Authenticated bookers can delete trade deals"
  ON public.trade_deals
  FOR DELETE
  TO authenticated
  USING (
    COALESCE(lower(booked_by_email), public.current_member_email()) = public.current_member_email()
  );
