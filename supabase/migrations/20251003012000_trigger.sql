-- ============================================
-- Migration 3: Create All Triggers
-- ============================================

-- Trigger for automatic profile creation on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profile_updated_at 
  BEFORE UPDATE ON public.profile
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_origins_updated_at 
  BEFORE UPDATE ON public.origins 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_elements_updated_at 
  BEFORE UPDATE ON public.elements 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supply_updated_at 
  BEFORE UPDATE ON public.supply 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supply_elements_updated_at 
  BEFORE UPDATE ON public.supply_elements 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_measurement_status_updated_at 
  BEFORE UPDATE ON public.measurement_status 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_measurement_units_updated_at 
  BEFORE UPDATE ON public.measurement_units 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_origins_updated_at
  BEFORE UPDATE ON public.customer_origins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- ============================================================================
-- Updated At Trigger
-- ============================================================================
CREATE TRIGGER update_models_updated_at
BEFORE UPDATE ON public.models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- ============================================
-- ML Models Table Triggers
-- ============================================

-- Auto-update timestamp trigger for models table
CREATE TRIGGER trigger_update_models_timestamp
  BEFORE UPDATE ON public.models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Settings drift detection trigger
-- Compares current system_settings with model's settings_snapshot
CREATE OR REPLACE FUNCTION check_models_settings_drift()
RETURNS TRIGGER AS $$
DECLARE
  current_settings JSONB;
  has_drift BOOLEAN;
BEGIN
  -- Get current ML settings from system_settings
  SELECT jsonb_object_agg(
    REPLACE(key, 'ml.', ''),
    CASE 
      WHEN value_type = 'number' THEN to_jsonb(value::NUMERIC)
      WHEN value_type = 'boolean' THEN to_jsonb(value::BOOLEAN)
      WHEN value_type = 'json' THEN value::JSONB
      ELSE to_jsonb(value)
    END
  ) INTO current_settings
  FROM system_settings
  WHERE category = 'neural_network';
  
  -- Compare with snapshot
  has_drift := (current_settings IS DISTINCT FROM NEW.settings_snapshot);
  
  NEW.settings_drift_detected := has_drift;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_check_models_settings_drift
  BEFORE INSERT OR UPDATE ON public.models
  FOR EACH ROW
  EXECUTE FUNCTION check_models_settings_drift();
-- Auto-deactivate other models trigger
-- When a model is set to active, deactivate all others
CREATE OR REPLACE FUNCTION deactivate_other_models()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.models
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_deactivate_other_models
  BEFORE INSERT OR UPDATE OF is_active ON public.models
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION deactivate_other_models();

-- ============================================
-- Closed-Group Messaging constraint triggers (M5)
-- Deferred so the atomic send_messages transaction can insert related rows
-- in any order while inconsistent commits are rejected.
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_message_participants_match_conversation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_conversation public.conversations;
BEGIN
  SELECT * INTO v_conversation FROM public.conversations WHERE id = NEW.conversation_id;

  IF NOT (
    (NEW.sender_user_id = v_conversation.participant_low_user_id
     AND NEW.recipient_user_id = v_conversation.participant_high_user_id)
    OR
    (NEW.sender_user_id = v_conversation.participant_high_user_id
     AND NEW.recipient_user_id = v_conversation.participant_low_user_id)
  ) THEN
    RAISE EXCEPTION 'message_participants_do_not_match_conversation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_message_participants_match_conversation
  AFTER INSERT OR UPDATE OF conversation_id, sender_user_id, recipient_user_id
  ON public.messages
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_participants_match_conversation();

CREATE OR REPLACE FUNCTION public.enforce_dispatch_recipient_consistency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_dispatch public.message_dispatch;
  v_message public.messages;
BEGIN
  IF NEW.status = 'accepted' THEN
    SELECT * INTO v_dispatch FROM public.message_dispatch WHERE id = NEW.dispatch_id;
    SELECT * INTO v_message FROM public.messages WHERE id = NEW.message_id;

    IF v_dispatch IS NULL OR v_message IS NULL THEN
      RAISE EXCEPTION 'dispatch_or_message_missing';
    END IF;

    IF v_message.sender_user_id <> v_dispatch.sender_user_id THEN
      RAISE EXCEPTION 'message_sender_does_not_match_dispatch';
    END IF;

    IF v_message.recipient_user_id <> NEW.recipient_user_id THEN
      RAISE EXCEPTION 'message_recipient_does_not_match_position';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_dispatch_recipient_consistency
  AFTER INSERT OR UPDATE OF dispatch_id, recipient_user_id, message_id, status
  ON public.message_dispatch_recipient
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dispatch_recipient_consistency();

-- ============================================
-- RFQ Aggregate constraint triggers (M8)
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_quote_invitation_consistency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_message public.messages;
BEGIN
  SELECT * INTO v_message FROM public.messages WHERE id = NEW.message_id;

  IF v_message IS NULL THEN
    RAISE EXCEPTION 'invitation_message_missing';
  END IF;

  IF v_message.conversation_id <> NEW.conversation_id THEN
    RAISE EXCEPTION 'invitation_message_conversation_mismatch';
  END IF;

  IF v_message.recipient_user_id <> NEW.recipient_user_id THEN
    RAISE EXCEPTION 'invitation_message_recipient_mismatch';
  END IF;

  IF v_message.quote_request_id IS DISTINCT FROM NEW.request_id THEN
    RAISE EXCEPTION 'invitation_message_rfq_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_quote_invitation_consistency
  AFTER INSERT OR UPDATE OF request_id, recipient_user_id, conversation_id, message_id
  ON public.quote_request_invitations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_invitation_consistency();

CREATE OR REPLACE FUNCTION public.enforce_quote_response_consistency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
  v_parent public.quote_responses;
BEGIN
  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = NEW.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id;

  IF v_invitation IS NULL OR v_request IS NULL THEN
    RAISE EXCEPTION 'response_referenced_objects_missing';
  END IF;

  IF NEW.parent_response_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM public.quote_responses WHERE id = NEW.parent_response_id;
    IF v_parent IS NULL OR v_parent.invitation_id <> NEW.invitation_id THEN
      RAISE EXCEPTION 'response_parent_invitation_mismatch';
    END IF;
  END IF;

  IF NEW.responder_user_id <> v_request.owner_user_id
     AND NEW.responder_user_id <> v_invitation.recipient_user_id THEN
    RAISE EXCEPTION 'response_responder_not_authorized';
  END IF;

  IF NEW.parent_response_id IS NULL AND NEW.responder_user_id <> v_invitation.recipient_user_id THEN
    RAISE EXCEPTION 'initial_response_must_be_recipient';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_quote_response_consistency
  AFTER INSERT OR UPDATE OF invitation_id, responder_user_id, parent_response_id
  ON public.quote_responses
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_response_consistency();

CREATE OR REPLACE FUNCTION public.enforce_trade_deal_consistency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_response public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
BEGIN
  SELECT * INTO v_response FROM public.quote_responses WHERE id = NEW.response_id;
  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_response.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = NEW.request_id;

  IF v_response IS NULL OR v_invitation IS NULL OR v_request IS NULL THEN
    RAISE EXCEPTION 'deal_referenced_objects_missing';
  END IF;

  IF v_invitation.request_id <> NEW.request_id THEN
    RAISE EXCEPTION 'deal_response_request_mismatch';
  END IF;

  IF NEW.counterparty_user_id <> v_invitation.recipient_user_id THEN
    RAISE EXCEPTION 'deal_counterparty_mismatch';
  END IF;

  IF NEW.product IS DISTINCT FROM v_request.terms->>'product' THEN
    RAISE EXCEPTION 'deal_product_does_not_match_terms';
  END IF;

  IF NEW.volume IS DISTINCT FROM v_request.terms->>'quantity' THEN
    RAISE EXCEPTION 'deal_volume_does_not_match_terms';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_trade_deal_consistency
  AFTER INSERT OR UPDATE OF request_id, response_id, counterparty_user_id, product, volume
  ON public.trade_deals
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_trade_deal_consistency();

CREATE OR REPLACE FUNCTION public.enforce_quote_workflow_idempotency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_response public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_message public.messages;
  v_deal public.trade_deals;
BEGIN
  SELECT * INTO v_response FROM public.quote_responses WHERE id = NEW.response_id;
  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_response.invitation_id;
  SELECT * INTO v_message FROM public.messages WHERE id = NEW.workflow_message_id;

  IF v_response IS NULL OR v_invitation IS NULL OR v_message IS NULL THEN
    RAISE EXCEPTION 'idempotency_referenced_objects_missing';
  END IF;

  IF v_message.conversation_id <> v_invitation.conversation_id THEN
    RAISE EXCEPTION 'idempotency_message_conversation_mismatch';
  END IF;

  IF NEW.deal_id IS NOT NULL THEN
    SELECT * INTO v_deal FROM public.trade_deals WHERE id = NEW.deal_id;
    IF v_deal IS NULL OR v_deal.response_id <> NEW.response_id THEN
      RAISE EXCEPTION 'idempotency_deal_response_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_quote_workflow_idempotency
  AFTER INSERT OR UPDATE OF workflow_message_id, response_id, deal_id
  ON public.quote_workflow_idempotency
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_workflow_idempotency();

-- Keep the conversation preview timestamp monotonic when a message is inserted.
CREATE OR REPLACE FUNCTION public.touch_conversation_preview()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = GREATEST(COALESCE(last_message_at, '-infinity'::timestamptz), NEW.created_at),
      updated_at = GREATEST(updated_at, NEW.created_at)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_conversation_preview
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_conversation_preview();

-- Append-only decision invariants: the RFQ owner decides, and a response may
-- only be accepted when it was authored by the invited counterparty.
CREATE OR REPLACE FUNCTION public.enforce_quote_response_decision_consistency()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  v_response public.quote_responses;
  v_invitation public.quote_request_invitations;
  v_request public.quote_requests;
BEGIN
  SELECT * INTO v_response FROM public.quote_responses WHERE id = NEW.response_id;
  SELECT * INTO v_invitation FROM public.quote_request_invitations WHERE id = v_response.invitation_id;
  SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id;

  IF v_response IS NULL OR v_invitation IS NULL OR v_request IS NULL THEN
    RAISE EXCEPTION 'decision_referenced_objects_missing';
  END IF;

  IF NEW.decided_by_user_id <> v_request.owner_user_id THEN
    RAISE EXCEPTION 'decision_must_be_by_rfq_owner';
  END IF;

  IF NEW.decision = 'accepted' AND v_response.responder_user_id <> v_invitation.recipient_user_id THEN
    RAISE EXCEPTION 'cannot_accept_own_response';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_quote_response_decision_consistency
  AFTER INSERT
  ON public.quote_response_decisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_response_decision_consistency();

CREATE OR REPLACE FUNCTION public.prevent_quote_response_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
  AS $$
BEGIN
  RAISE EXCEPTION 'quote_response_immutable';
END;
$$;

CREATE TRIGGER prevent_quote_response_mutation
  BEFORE UPDATE OR DELETE
  ON public.quote_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_quote_response_mutation();

CREATE OR REPLACE FUNCTION public.prevent_quote_response_decision_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
  AS $$
BEGIN
  RAISE EXCEPTION 'quote_response_decision_immutable';
END;
$$;

CREATE TRIGGER prevent_quote_response_decision_mutation
  BEFORE UPDATE OR DELETE
  ON public.quote_response_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_quote_response_decision_mutation();
