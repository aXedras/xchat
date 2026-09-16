-- ============================================
-- Delete conversation (hard delete) — M11
-- ============================================

-- Missing indexes required by the new DELETE queries below. Without these,
-- every delete_conversation() call performs full table scans on
-- quote_request_invitations, message_dispatch_recipient and
-- quote_workflow_idempotency.
CREATE INDEX IF NOT EXISTS idx_quote_invitations_conversation
  ON public.quote_request_invitations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_recipient_message
  ON public.message_dispatch_recipient(message_id);

CREATE INDEX IF NOT EXISTS idx_quote_workflow_idempotency_workflow_message
  ON public.quote_workflow_idempotency(workflow_message_id);

-- Hard-deletes a bilateral conversation and its messages for both
-- participants. Refuses to delete (raises 'conversation_has_activity') if
-- the conversation carries RFQ responses or a booked trade deal, to protect
-- business/financial records from incidental loss via a chat cleanup
-- action. quote_requests and message_dispatch are intentionally left
-- untouched (may become orphaned; they can be referenced by other
-- conversations via fan-out RFQ sends).
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_conversation public.conversations;
  v_counterparty uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  -- Lock the conversation row to serialize concurrent delete_conversation
  -- calls targeting the same conversation.
  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  -- Missing row and "not a participant" intentionally raise the identical
  -- error code to avoid leaking whether a conversation id exists at all.
  IF v_conversation IS NULL
     OR (v_conversation.participant_low_user_id <> v_uid
         AND v_conversation.participant_high_user_id <> v_uid) THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  v_counterparty := CASE
    WHEN v_conversation.participant_low_user_id = v_uid
      THEN v_conversation.participant_high_user_id
      ELSE v_conversation.participant_low_user_id
  END;

  -- Guard: refuse to delete if any RFQ response (and therefore possibly a
  -- booked trade deal) exists for this conversation. Unanswered RFQ
  -- invitations (no response yet) do not block deletion.
  IF EXISTS (
    SELECT 1
    FROM public.quote_request_invitations qri
    JOIN public.quote_responses qr ON qr.invitation_id = qri.id
    WHERE qri.conversation_id = p_conversation_id
  ) THEN
    PERFORM public.raise_business_error('conversation_has_activity');
  END IF;

  BEGIN
    DELETE FROM public.quote_workflow_idempotency
    WHERE workflow_message_id IN (
      SELECT id FROM public.messages WHERE conversation_id = p_conversation_id
    );

    DELETE FROM public.quote_request_invitations
    WHERE conversation_id = p_conversation_id;

    DELETE FROM public.message_dispatch_recipient
    WHERE message_id IN (
      SELECT id FROM public.messages WHERE conversation_id = p_conversation_id
    );

    DELETE FROM public.messages
    WHERE conversation_id = p_conversation_id;

    DELETE FROM public.conversations
    WHERE id = p_conversation_id;
  EXCEPTION WHEN foreign_key_violation THEN
    -- Narrow scope: only convert to the business error when the concurrent
    -- RFQ action actually produced RFQ/trade activity (see NFR 4.2). Any
    -- other foreign_key_violation is an unexpected dependency and must not
    -- be masked as 'conversation_has_activity'.
    IF EXISTS (
      SELECT 1
      FROM public.quote_request_invitations qri
      JOIN public.quote_responses qr ON qr.invitation_id = qri.id
      WHERE qri.conversation_id = p_conversation_id
    ) THEN
      PERFORM public.raise_business_error('conversation_has_activity');
    END IF;
    RAISE;
  END;

  -- Best-effort notify the counterparty so their stale client removes the
  -- conversation without a reload. Enqueue failures must not fail the delete.
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'conversationId', p_conversation_id,
        'deletedByUserId', v_uid
      ),
      'conversation.deleted',
      'user:' || v_counterparty,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'realtime enqueue failed for delete_conversation %', p_conversation_id;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_conversation(uuid) FROM PUBLIC, anon;
