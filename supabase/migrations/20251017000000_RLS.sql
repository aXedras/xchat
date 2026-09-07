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
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_dispatch_recipient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_response_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_workflow_idempotency ENABLE ROW LEVEL SECURITY;
-- Create simple authenticated access policies for all tables
-- Note: No DROP statements needed as this is a clean migration
CREATE POLICY "Users can read profiles" ON public.profile
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own profile" ON public.profile
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
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

-- Closed-Group Messaging RLS (M6)
CREATE POLICY "Conversation participants can read"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (participant_low_user_id, participant_high_user_id));

CREATE POLICY "Message participants can read"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (sender_user_id, recipient_user_id));

CREATE POLICY "Dispatch sender can read"
  ON public.message_dispatch
  FOR SELECT
  TO authenticated
  USING (sender_user_id = auth.uid());

CREATE POLICY "Dispatch sender can read recipients"
  ON public.message_dispatch_recipient
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.message_dispatch d
      WHERE d.id = dispatch_id
        AND d.sender_user_id = auth.uid()
    )
  );

-- RFQ Aggregate RLS (M8)
CREATE POLICY "RFQ owner can read"
  ON public.quote_requests
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "RFQ owner or recipient can read invitations"
  ON public.quote_request_invitations
  FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.quote_requests q
      WHERE q.id = request_id AND q.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "RFQ owner or recipient can read responses"
  ON public.quote_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_request_invitations i
      WHERE i.id = invitation_id
        AND (
          i.recipient_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.quote_requests q
            WHERE q.id = i.request_id AND q.owner_user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Deal parties can read"
  ON public.trade_deals
  FOR SELECT
  TO authenticated
  USING (counterparty_user_id = auth.uid() OR booked_by_user_id = auth.uid());

-- Realtime Broadcast authorization (M10): clients may only receive the
-- broadcast topic that belongs to their own user id.
CREATE POLICY "Users can receive own user-topic broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() = 'user:' || auth.uid()::text
  );
