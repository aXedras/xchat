-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
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

-- Profile and role access policies
CREATE POLICY "Users can read profiles" ON public.profile
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own profile" ON public.profile
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated full access" ON public.system_settings
  FOR ALL USING (auth.uid() IS NOT NULL);

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
