-- ============================================
-- xChat Closed-Group Messaging Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversations_participant_high
  ON public.conversations(participant_high_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON public.conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_cursor
  ON public.messages(conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at
  ON public.messages(sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created_at
  ON public.messages(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_dispatch_sender_created_at
  ON public.message_dispatch(sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_recipient_dispatch
  ON public.message_dispatch_recipient(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_owner_created_at
  ON public.quote_requests(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_invitations_request
  ON public.quote_request_invitations(request_id);
CREATE INDEX IF NOT EXISTS idx_quote_invitations_recipient
  ON public.quote_request_invitations(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_quote_responses_invitation_cursor
  ON public.quote_responses(invitation_id, created_at ASC, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_responses_single_root
  ON public.quote_responses(invitation_id)
  WHERE parent_response_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_trade_deals_request
  ON public.trade_deals(request_id);
