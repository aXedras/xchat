-- Closed-Group Messaging MVP — Database tests (pgTAP)
-- Extends per micro-step M0a, M4, M5, M6, M7, M8, M9, M9a, M10.
-- Executed via `npm run supabase:test` (supabase test db).

BEGIN;

SELECT plan(134);

-- M0a: Realtime capability prerequisites
SELECT has_schema('realtime', 'realtime schema exists');
SELECT has_table('realtime', 'messages', 'realtime.messages table exists');

SELECT has_function(
  'realtime',
  'send',
  ARRAY['jsonb', 'text', 'text', 'boolean'],
  'realtime.send(jsonb,text,text,boolean) exists'
);

SELECT has_function(
  'realtime',
  'topic',
  ARRAY[]::text[],
  'realtime.topic() exists'
);

-- realtime.messages must have RLS enabled (Supabase default)
SELECT results_eq(
  $$SELECT relrowsecurity FROM pg_class WHERE oid = 'realtime.messages'::regclass$$,
  $$VALUES (true)$$,
  'realtime.messages has RLS enabled'
);

-- A SELECT policy can be defined on realtime.messages using realtime.topic()
-- (drop in the same transaction; proves the table accepts the required policy shape)
CREATE POLICY "m0a capability broadcast policy"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() = 'user:m0a'
  );

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'm0a capability broadcast policy'
  ),
  'broadcast policy can be created on realtime.messages'
);

DROP POLICY "m0a capability broadcast policy" ON realtime.messages;

-- realtime.send() is invokable (returns void) for a private topic
SELECT lives_ok(
  $$SELECT realtime.send('{}'::jsonb, 'm0a', 'user:m0a', true)$$,
  'realtime.send() is invokable for a private topic'
);

-- No INSERT policy for authenticated clients by default (clients must not publish)
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND cmd IN ('INSERT', 'ALL')
  ),
  'no authenticated INSERT policy exists on realtime.messages'
);

-- M4: canonical role source
SELECT has_function(
  'public',
  'get_my_role',
  ARRAY[]::text[],
  'public.get_my_role() exists'
);

SELECT col_is_unique('public', 'user_roles', 'user_id', 'user_roles.user_id is unique');

SELECT fk_ok(
  'public',
  'user_roles',
  'user_id',
  'auth',
  'users',
  'id',
  'user_roles.user_id references auth.users(id)'
);

-- get_my_role() returns NULL without an authenticated user
SELECT is(get_my_role(), NULL, 'get_my_role() returns NULL without auth user');

-- authenticated role cannot write user_roles (only SELECT granted)
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'vendor')$$,
  '42501',
  NULL,
  'authenticated cannot INSERT user_roles'
);
RESET ROLE;

-- M5: user-id based messaging schema
SELECT has_table('public', 'conversations', 'conversations table exists');
SELECT has_table('public', 'messages', 'messages table exists');
SELECT has_table('public', 'message_dispatch', 'message_dispatch table exists');
SELECT has_table('public', 'message_dispatch_recipient', 'message_dispatch_recipient table exists');

SELECT col_is_unique(
  'public',
  'conversations',
  ARRAY['participant_low_user_id', 'participant_high_user_id'],
  'conversations participant pair is unique'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'conversations'
      AND c.conname = 'conversations_pair_ordered'
      AND c.contype = 'c'
  ),
  'conversations pair ordering check exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'messages'
      AND c.conname = 'messages_distinct_participants'
      AND c.contype = 'c'
  ),
  'messages distinct participants check exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'message_dispatch_recipient'
      AND c.conname = 'dispatch_recipient_shape'
      AND c.contype = 'c'
  ),
  'dispatch recipient shape check exists'
);

SELECT fk_ok('public', 'messages', 'conversation_id', 'public', 'conversations', 'id', 'messages.conversation_id -> conversations.id');
SELECT fk_ok('public', 'messages', 'sender_user_id', 'auth', 'users', 'id', 'messages.sender_user_id -> auth.users.id');

-- M6: read RPCs and RLS policies
SELECT has_function('public', 'list_participants', ARRAY[]::text[], 'list_participants() exists');
SELECT has_function('public', 'list_conversations', ARRAY[]::text[], 'list_conversations() exists');
SELECT has_function('public', 'list_messages', ARRAY['uuid', 'timestamptz', 'uuid', 'integer'], 'list_messages(...) exists');
SELECT has_function('public', 'get_message', ARRAY['uuid'], 'get_message(uuid) exists');
SELECT has_function('public', 'get_dispatch', ARRAY['uuid'], 'get_dispatch(uuid) exists');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversations', 'messages', 'message_dispatch', 'message_dispatch_recipient')
      AND cmd = 'SELECT'
  ),
  'messaging SELECT policies exist'
);

-- M7: bilateral conversation resolver
SELECT has_function('public', 'resolve_bilateral_conversation', ARRAY['uuid', 'uuid'], 'resolve_bilateral_conversation(uuid,uuid) exists');

CREATE TEMP TABLE _m7_users (slot int, user_id uuid);

DO $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm7-a@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _m7_users VALUES (1, v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm7-b@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _m7_users VALUES (2, v_id);
END $$;

SELECT is(
  public.resolve_bilateral_conversation(
    (SELECT user_id FROM _m7_users WHERE slot = 1),
    (SELECT user_id FROM _m7_users WHERE slot = 2)
  ),
  public.resolve_bilateral_conversation(
    (SELECT user_id FROM _m7_users WHERE slot = 2),
    (SELECT user_id FROM _m7_users WHERE slot = 1)
  ),
  'resolver is symmetric for the same pair'
);

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE participant_low_user_id = LEAST((SELECT user_id FROM _m7_users WHERE slot = 1), (SELECT user_id FROM _m7_users WHERE slot = 2))
     AND participant_high_user_id = GREATEST((SELECT user_id FROM _m7_users WHERE slot = 1), (SELECT user_id FROM _m7_users WHERE slot = 2))),
  1::bigint,
  'exactly one conversation exists for the pair'
);

-- M8: RFQ aggregate schema and read RPCs
SELECT has_table('public', 'quote_requests', 'quote_requests table exists');
SELECT has_table('public', 'quote_request_invitations', 'quote_request_invitations table exists');
SELECT has_table('public', 'quote_responses', 'quote_responses table exists');
SELECT has_table('public', 'trade_deals', 'trade_deals table exists');
SELECT has_table('public', 'quote_workflow_idempotency', 'quote_workflow_idempotency table exists');

SELECT fk_ok('public', 'messages', 'quote_request_id', 'public', 'quote_requests', 'id', 'messages.quote_request_id -> quote_requests.id');

SELECT has_function('public', 'effective_quote_status', ARRAY['uuid'], 'effective_quote_status(uuid) exists');
SELECT has_function('public', 'list_quote_invitations', ARRAY[]::text[], 'list_quote_invitations() exists');
SELECT has_function('public', 'list_quote_responses', ARRAY['uuid'], 'list_quote_responses(uuid) exists');

-- M9: send_messages
SELECT has_function('public', 'send_messages', ARRAY['jsonb'], 'send_messages(jsonb) exists');

CREATE TEMP TABLE _m9_users (slot text, user_id uuid);

DO $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm9-sender@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _m9_users VALUES ('sender', v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm9-a@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _m9_users VALUES ('a', v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm9-b@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _m9_users VALUES ('b', v_id);
END $$;

GRANT SELECT ON _m9_users TO authenticated;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.send_messages('{}'::jsonb)$$,
  'P0001',
  'unauthenticated',
  'send_messages without session raises unauthenticated'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

SELECT throws_ok(
  $$SELECT public.send_messages(jsonb_build_object('dispatchId', gen_random_uuid()::text, 'messageType', 'nope', 'content', 'x', 'recipientIds', '[]'::jsonb))$$,
  'P0001',
  'invalid_message_type',
  'send_messages rejects unknown message type'
);

SELECT throws_ok(
  $$SELECT public.send_messages(jsonb_build_object('dispatchId', gen_random_uuid()::text, 'messageType', 'rfq', 'content', 'rfq', 'recipientIds', jsonb_build_array('00000000-0000-0000-0000-0000000000ff'::uuid::text)))$$,
  'P0001',
  'invalid_rfq_terms',
  'send_messages rejects rfq without valid terms'
);

CREATE TEMP TABLE _m9_d1 AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d1',
  'messageType', 'rfq',
  'content', 'RFQ for gold',
  'recipientIds', jsonb_build_array(
    (SELECT user_id::text FROM _m9_users WHERE slot = 'a'),
    (SELECT user_id::text FROM _m9_users WHERE slot = 'b')
  ),
  'rfqTerms', jsonb_build_object(
    'quantity', '6x1KG', 'product', 'Gold', 'productCode', 'XAU', 'productClass', 'gold',
    'quality', 'LBMA good delivery', 'location', 'Zurich', 'priceBasis', 'ZRH fixing',
    'premium', '+0.25', 'rawTerms', 'LBMA ZRH fixing +0.25', 'responseTtlSeconds', 3600
  )
)) AS result;

CREATE TEMP TABLE _m9_d2 AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d2',
  'messageType', 'standard',
  'content', 'partial test',
  'recipientIds', jsonb_build_array(
    (SELECT user_id::text FROM _m9_users WHERE slot = 'a'),
    '00000000-0000-0000-0000-0000000000de'
  )
)) AS result;

CREATE TEMP TABLE _m9_d3 AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d3',
  'messageType', 'standard',
  'content', 'self test',
  'recipientIds', jsonb_build_array((SELECT user_id::text FROM _m9_users WHERE slot = 'sender'))
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'dispatch'->>'status' FROM _m9_d1), 'completed', 'rfq fanout completed');
SELECT is((SELECT jsonb_array_length(result->'dispatch'->'recipients') FROM _m9_d1), 2, 'two recipient positions');
SELECT is((SELECT count(*) FROM public.messages WHERE content = 'RFQ for gold'), 2::bigint, 'two messages persisted');
SELECT is(
  (SELECT count(*) FROM public.quote_request_invitations i JOIN public.messages m ON m.id = i.message_id WHERE m.content = 'RFQ for gold'),
  2::bigint,
  'two invitations persisted'
);
SELECT is(
  (SELECT count(DISTINCT r.id) FROM public.quote_requests r JOIN public.messages m ON m.quote_request_id = r.id WHERE m.content = 'RFQ for gold'),
  1::bigint,
  'one quote request persisted'
);
SELECT is((SELECT result->'dispatch'->>'status' FROM _m9_d2), 'partial', 'partial dispatch for missing recipient');
SELECT is((SELECT result->'dispatch'->>'status' FROM _m9_d3), 'failed', 'self-only dispatch failed');
SELECT is((SELECT result->'dispatch'->'recipients'->0->>'errorCode' FROM _m9_d3), 'self_recipient', 'self recipient error code');

-- M9a: RFQ mutation RPCs
SELECT has_function('public', 'submit_quote_response', ARRAY['jsonb'], 'submit_quote_response(jsonb) exists');
SELECT has_function('public', 'counter_quote_response', ARRAY['jsonb'], 'counter_quote_response(jsonb) exists');
SELECT has_function('public', 'reject_quote_response', ARRAY['jsonb'], 'reject_quote_response(jsonb) exists');
SELECT has_function('public', 'book_quote_response', ARRAY['jsonb'], 'book_quote_response(jsonb) exists');

-- sender sends rfq to A only
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9a_send AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d4',
  'messageType', 'rfq',
  'content', 'RFQ A only',
  'recipientIds', jsonb_build_array((SELECT user_id::text FROM _m9_users WHERE slot = 'a')),
  'rfqTerms', jsonb_build_object(
    'quantity', '1KG', 'product', 'Gold', 'productCode', 'XAU', 'productClass', 'gold',
    'quality', 'LBMA', 'location', 'Zurich', 'priceBasis', 'ZRH fixing',
    'premium', '+0.25', 'rawTerms', 'ZRH fixing +0.25', 'responseTtlSeconds', 86400
  )
)) AS result;

RESET ROLE;

CREATE TEMP TABLE _m9a_inv AS
SELECT i.id, i.request_id, i.conversation_id
FROM public.quote_request_invitations i
JOIN public.messages m ON m.id = i.message_id
WHERE m.content = 'RFQ A only';

GRANT SELECT ON _m9a_inv TO authenticated;

-- A submits initial quote
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'a'))::text, true);

CREATE TEMP TABLE _m9a_submit AS
SELECT public.submit_quote_response(jsonb_build_object(
  'invitationId', (SELECT id FROM _m9a_inv),
  'clientResponseId', '00000000-0000-0000-0000-0000000000c1',
  'quotedPremium', '+0.20',
  'notes', 'first quote'
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'response'->>'status' FROM _m9a_submit), 'submitted', 'initial quote submitted');
SELECT is(
  (SELECT count(*) FROM public.quote_responses WHERE invitation_id = (SELECT id FROM _m9a_inv)),
  1::bigint,
  'one response after submit'
);
SELECT is(
  (SELECT count(*) FROM public.quote_workflow_idempotency WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)),
  1::bigint,
  'one idempotency record after submit'
);

-- idempotent replay returns the same response (composite IS NOT NULL regression)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'a'))::text, true);

CREATE TEMP TABLE _m9a_replay AS
SELECT public.submit_quote_response(jsonb_build_object(
  'invitationId', (SELECT id FROM _m9a_inv),
  'clientResponseId', '00000000-0000-0000-0000-0000000000c1',
  'quotedPremium', '+0.20',
  'notes', 'first quote'
)) AS result;

RESET ROLE;

SELECT is(
  (SELECT result->'response'->>'id' FROM _m9a_replay),
  (SELECT result->'response'->>'id' FROM _m9a_submit),
  'replay returns the same response id'
);
SELECT is(
  (SELECT count(*) FROM public.quote_responses WHERE invitation_id = (SELECT id FROM _m9a_inv)),
  1::bigint,
  'replay did not duplicate the response'
);

-- sender counters
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9a_counter AS
SELECT public.counter_quote_response(jsonb_build_object(
  'parentResponseId', (SELECT result->'response'->>'id' FROM _m9a_submit),
  'clientResponseId', '00000000-0000-0000-0000-0000000000c2',
  'quotedPremium', '+0.18',
  'notes', NULL
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'response'->>'status' FROM _m9a_counter), 'countered', 'counter quote created');

-- owner cannot book their own counter (no decision yet)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

SELECT throws_ok(
  $$SELECT public.book_quote_response(jsonb_build_object('responseId', (SELECT result->'response'->>'id' FROM _m9a_counter), 'clientActionId', '00000000-0000-0000-0000-0000000000c9'))$$,
  'P0001',
  'not_authorized',
  'owner cannot book own counter'
);

-- Finding 9 (7): the same invariant holds at the database level, bypassing the
-- public RPC entirely. Reset out of the `authenticated` role first: this
-- table has no client-facing grants at all (only the SECURITY DEFINER RPCs
-- may write it), so the direct insert must run as the table owner in order to
-- reach `enforce_quote_response_decision_consistency` rather than fail on a
-- grants check. That trigger is a deferrable constraint trigger (checked at
-- COMMIT by default); force immediate checking so the direct INSERT below
-- raises within this statement instead of being silently deferred past the
-- test's final ROLLBACK.
RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT throws_ok(
  format(
    $$INSERT INTO public.quote_response_decisions (response_id, decided_by_user_id, decision, client_action_id)
      VALUES (%L, %L, 'accepted', gen_random_uuid())$$,
    (SELECT result->'response'->>'id' FROM _m9a_counter),
    (SELECT user_id FROM _m9_users WHERE slot = 'sender')
  ),
  'P0001',
  'cannot_accept_own_response',
  'a direct insert accepting the owner''s own counteroffer is rejected by the decision consistency trigger'
);
SET CONSTRAINTS ALL DEFERRED;
SELECT is(
  (SELECT count(*) FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_counter)::uuid)),
  0::bigint,
  'no decision exists for the counter response after the rejected direct insert'
);

-- restore the sender's authenticated session for the remaining RPC calls
-- below (also re-establishes ownership of the _m9a_reject/_m9a_book temp
-- tables as the authenticated role, matching how later blocks read them)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

-- owner rejects the counter (append-only decision)
CREATE TEMP TABLE _m9a_reject AS
SELECT public.reject_quote_response(jsonb_build_object(
  'responseId', (SELECT result->'response'->>'id' FROM _m9a_counter),
  'clientActionId', '00000000-0000-0000-0000-0000000000c8'
)) AS result;

-- owner books the recipient's original quote
CREATE TEMP TABLE _m9a_book AS
SELECT public.book_quote_response(jsonb_build_object(
  'responseId', (SELECT result->'response'->>'id' FROM _m9a_submit),
  'clientActionId', '00000000-0000-0000-0000-0000000000c3'
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'deal'->>'status' FROM _m9a_book), 'booked', 'deal booked');
SELECT is(
  (SELECT count(*) FROM public.trade_deals WHERE request_id = (SELECT request_id FROM _m9a_inv)),
  1::bigint,
  'one deal exists'
);
SELECT is((SELECT status FROM public.quote_requests WHERE id = (SELECT request_id FROM _m9a_inv)), 'converted', 'rfq converted after booking');
SELECT is((SELECT status FROM public.quote_responses WHERE id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)), 'submitted', 'booked response stays append-only');
SELECT is((SELECT decision FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)), 'accepted', 'accepted decision recorded');
SELECT is((SELECT status FROM public.quote_responses WHERE id = ((SELECT result->'response'->>'id' FROM _m9a_counter)::uuid)), 'countered', 'rejected response stays append-only');
SELECT is((SELECT decision FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_counter)::uuid)), 'rejected', 'rejected decision recorded');
SELECT is(
  (SELECT count(*) FROM public.quote_response_decisions
   WHERE response_id IN (
     (SELECT result->'response'->>'id' FROM _m9a_submit)::uuid,
     (SELECT result->'response'->>'id' FROM _m9a_counter)::uuid
   )),
  2::bigint,
  'two decisions recorded'
);

SELECT throws_ok(
  format(
    'UPDATE public.quote_responses SET quoted_premium = %L WHERE id = %L',
    '+9.99',
    (SELECT result->'response'->>'id' FROM _m9a_submit)
  ),
  'P0001',
  'quote_response_immutable',
  'quote response update is rejected'
);
SELECT is(
  (SELECT quoted_premium FROM public.quote_responses WHERE id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)),
  '+0.20',
  'quote response remains unchanged after rejected update'
);
SELECT throws_ok(
  format(
    'DELETE FROM public.quote_responses WHERE id = %L',
    (SELECT result->'response'->>'id' FROM _m9a_submit)
  ),
  'P0001',
  'quote_response_immutable',
  'quote response delete is rejected'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.quote_responses
    WHERE id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)
  ),
  'quote response remains after rejected delete'
);
SELECT throws_ok(
  format(
    'UPDATE public.quote_response_decisions SET decision = %L WHERE response_id = %L',
    'rejected',
    (SELECT result->'response'->>'id' FROM _m9a_submit)
  ),
  'P0001',
  'quote_response_decision_immutable',
  'quote response decision update is rejected'
);
SELECT is(
  (SELECT decision FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)),
  'accepted',
  'quote response decision remains unchanged after rejected update'
);
SELECT throws_ok(
  format(
    'DELETE FROM public.quote_response_decisions WHERE response_id = %L',
    (SELECT result->'response'->>'id' FROM _m9a_submit)
  ),
  'P0001',
  'quote_response_decision_immutable',
  'quote response decision delete is rejected'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.quote_response_decisions
    WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)
  ),
  'quote response decision remains after rejected delete'
);

-- Finding 2: idempotent full replay returns the stored snapshot without duplicating
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9_full_replay AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d2',
  'messageType', 'standard',
  'content', 'partial test',
  'recipientIds', jsonb_build_array(
    (SELECT user_id::text FROM _m9_users WHERE slot = 'a'),
    '00000000-0000-0000-0000-0000000000de'
  )
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'dispatch'->>'status' FROM _m9_full_replay), 'partial', 'full replay returns the stored dispatch status');
SELECT is((SELECT jsonb_array_length(result->'dispatch'->'messages') FROM _m9_full_replay), 1, 'full replay returns the stored message');
SELECT is((SELECT count(*) FROM public.messages WHERE content = 'partial test'), 1::bigint, 'full replay does not duplicate the message');

-- Finding 2: counter replay returns the same response snapshot
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9_counter_replay AS
SELECT public.counter_quote_response(jsonb_build_object(
  'parentResponseId', (SELECT result->'response'->>'id' FROM _m9a_submit),
  'clientResponseId', '00000000-0000-0000-0000-0000000000c2',
  'quotedPremium', '+0.18',
  'notes', NULL
)) AS result;

RESET ROLE;

SELECT is(
  (SELECT result->'response'->>'id' FROM _m9_counter_replay),
  (SELECT result->'response'->>'id' FROM _m9a_counter),
  'counter replay returns the same response'
);
SELECT is(
  (SELECT count(*) FROM public.quote_responses WHERE invitation_id = (SELECT id FROM _m9a_inv) AND parent_response_id IS NOT NULL),
  1::bigint,
  'counter replay does not duplicate the response'
);

-- Finding 2: reject replay returns the same decision snapshot
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9_reject_replay AS
SELECT public.reject_quote_response(jsonb_build_object(
  'responseId', (SELECT result->'response'->>'id' FROM _m9a_counter),
  'clientActionId', '00000000-0000-0000-0000-0000000000c8'
)) AS result;

RESET ROLE;

SELECT is(
  (SELECT decision FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_counter)::uuid)),
  'rejected',
  'reject replay keeps the rejected decision'
);
SELECT is(
  (SELECT count(*) FROM public.quote_response_decisions
   WHERE response_id IN (
     (SELECT result->'response'->>'id' FROM _m9a_submit)::uuid,
     (SELECT result->'response'->>'id' FROM _m9a_counter)::uuid
   )),
  2::bigint,
  'reject replay does not duplicate the decision'
);

-- Finding 2: book replay returns the same deal snapshot
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9_book_replay AS
SELECT public.book_quote_response(jsonb_build_object(
  'responseId', (SELECT result->'response'->>'id' FROM _m9a_submit),
  'clientActionId', '00000000-0000-0000-0000-0000000000c3'
)) AS result;

RESET ROLE;

SELECT is(
  (SELECT result->'deal'->>'id' FROM _m9_book_replay),
  (SELECT result->'deal'->>'id' FROM _m9a_book),
  'book replay returns the same deal'
);
SELECT is(
  (SELECT count(*) FROM public.trade_deals WHERE request_id = (SELECT request_id FROM _m9a_inv)),
  1::bigint,
  'book replay does not duplicate the deal'
);

-- Finding 2: replay with a changed payload raises idempotency_payload_mismatch
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'a'))::text, true);

SELECT throws_ok(
  $$SELECT public.submit_quote_response(jsonb_build_object(
    'invitationId', (SELECT id FROM _m9a_inv),
    'clientResponseId', '00000000-0000-0000-0000-0000000000c1',
    'quotedPremium', '+0.19',
    'notes', 'first quote'
  ))$$,
  'P0001',
  'idempotency_payload_mismatch',
  'submit replay with changed payload raises idempotency_payload_mismatch'
);

RESET ROLE;

-- M9b: partial dispatch retry
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9b_d5 AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d5',
  'messageType', 'standard',
  'content', 'fanout retry test',
  'recipientIds', jsonb_build_array(
    (SELECT user_id::text FROM _m9_users WHERE slot = 'a'),
    '00000000-0000-0000-0000-0000000000de'
  )
)) AS result;

CREATE TEMP TABLE _m9b_d5_retry AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d5',
  'messageType', 'standard',
  'content', 'fanout retry test',
  'recipientIds', jsonb_build_array(
    (SELECT user_id::text FROM _m9_users WHERE slot = 'a'),
    '00000000-0000-0000-0000-0000000000de'
  ),
  'retryRecipientIds', jsonb_build_array('00000000-0000-0000-0000-0000000000de')
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'dispatch'->>'status' FROM _m9b_d5), 'partial', 'fanout with missing recipient is partial');
SELECT is((SELECT count(*) FROM public.messages WHERE content = 'fanout retry test'), 1::bigint, 'only accepted recipient message persisted');
SELECT is((SELECT result->'dispatch'->>'status' FROM _m9b_d5_retry), 'partial', 'retry of still-missing recipient stays partial');
SELECT is((SELECT count(*) FROM public.messages WHERE content = 'fanout retry test'), 1::bigint, 'retry did not duplicate accepted message');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

SELECT throws_ok(
  $$SELECT public.send_messages(jsonb_build_object('dispatchId', '00000000-0000-0000-0000-0000000000d5', 'messageType', 'standard', 'content', 'fanout retry test', 'recipientIds', jsonb_build_array('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000de'), 'retryRecipientIds', jsonb_build_array('00000000-0000-0000-0000-0000000000de')))$$,
  'P0001',
  'dispatch_payload_mismatch',
  'retry with altered original recipient set raises dispatch_payload_mismatch'
);

RESET ROLE;

-- Finding 9 (4): fan-out retry succeeds once a previously-missing recipient becomes available
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9c_d6 AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d6',
  'messageType', 'standard',
  'content', 'fanout becomes available test',
  'recipientIds', jsonb_build_array(
    (SELECT user_id::text FROM _m9_users WHERE slot = 'a'),
    '00000000-0000-0000-0000-0000000000e1'
  )
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'dispatch'->>'status' FROM _m9c_d6), 'partial', 'fanout is partial while the second recipient does not exist yet');
SELECT is(
  (SELECT count(*) FROM public.messages WHERE content = 'fanout becomes available test'),
  1::bigint,
  'only the available recipient message exists before the retry'
);

-- the previously-missing recipient now becomes a real user
DO $$
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e1'::uuid, 'authenticated', 'authenticated', 'm9c-late@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '');
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

CREATE TEMP TABLE _m9c_d6_retry AS
SELECT public.send_messages(jsonb_build_object(
  'dispatchId', '00000000-0000-0000-0000-0000000000d6',
  'messageType', 'standard',
  'content', 'fanout becomes available test',
  'recipientIds', jsonb_build_array(
    (SELECT user_id::text FROM _m9_users WHERE slot = 'a'),
    '00000000-0000-0000-0000-0000000000e1'
  ),
  'retryRecipientIds', jsonb_build_array('00000000-0000-0000-0000-0000000000e1')
)) AS result;

RESET ROLE;

SELECT is((SELECT result->'dispatch'->>'status' FROM _m9c_d6_retry), 'completed', 'retry completes once the missing recipient exists');
SELECT is(
  (SELECT count(*) FROM public.messages WHERE content = 'fanout becomes available test' AND recipient_user_id = '00000000-0000-0000-0000-0000000000e1'::uuid),
  1::bigint,
  'the newly available recipient received exactly one message'
);
SELECT is(
  (SELECT count(*) FROM public.messages WHERE content = 'fanout becomes available test' AND recipient_user_id = (SELECT user_id FROM _m9_users WHERE slot = 'a')),
  1::bigint,
  'the originally accepted recipient message was not duplicated by the retry'
);

-- Finding 9 (3): the conversation preview reflects the chronologically latest
-- message even when rows are inserted out of chronological order, not merely
-- whichever row was physically inserted last.
RESET ROLE;

CREATE TEMP TABLE _m9d_ooo AS
SELECT
  (SELECT conversation_id FROM _m9a_inv) AS conversation_id,
  (SELECT user_id FROM _m9_users WHERE slot = 'sender') AS sender_id,
  (SELECT user_id FROM _m9_users WHERE slot = 'a') AS recipient_id;

GRANT SELECT ON _m9d_ooo TO authenticated;

-- Insert the chronologically LATER message first...
INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, type, content, created_at)
VALUES (
  (SELECT conversation_id FROM _m9d_ooo),
  (SELECT sender_id FROM _m9d_ooo),
  (SELECT recipient_id FROM _m9d_ooo),
  'standard',
  'ooo-later-message',
  now() + interval '1 hour'
);

-- ...then insert a chronologically EARLIER message afterwards (an out-of-order insert).
INSERT INTO public.messages (conversation_id, sender_user_id, recipient_user_id, type, content, created_at)
VALUES (
  (SELECT conversation_id FROM _m9d_ooo),
  (SELECT sender_id FROM _m9d_ooo),
  (SELECT recipient_id FROM _m9d_ooo),
  'standard',
  'ooo-earlier-message',
  now()
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT sender_id FROM _m9d_ooo))::text, true);

SELECT is(
  (SELECT elem->>'lastMessage'
   FROM jsonb_array_elements(public.list_conversations()) elem
   WHERE (elem->>'id')::uuid = (SELECT conversation_id FROM _m9d_ooo)),
  'ooo-later-message',
  'conversation preview shows the chronologically latest message even though it was inserted first'
);
SELECT ok(
  (SELECT (elem->>'lastMessageAt')::timestamptz
   FROM jsonb_array_elements(public.list_conversations()) elem
   WHERE (elem->>'id')::uuid = (SELECT conversation_id FROM _m9d_ooo))
    > now(),
  'conversation lastMessageAt reflects the later timestamp, not the later insert'
);

RESET ROLE;

-- Finding 8: a stranger unrelated to the sender/a/b conversation and RFQ
CREATE TEMP TABLE _m9_stranger (slot text, user_id uuid);

DO $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm9-stranger@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _m9_stranger VALUES ('stranger', v_id);
END $$;

GRANT SELECT ON _m9_stranger TO authenticated;

-- The RFQ aggregate tables have no client-facing table grants today (all
-- production access goes through the SECURITY DEFINER RPCs); grant SELECT to
-- authenticated for the remainder of this test transaction only (rolled back
-- with everything else at ROLLBACK) so the RLS policies themselves — a
-- defense-in-depth layer independent of the RPC surface — are verified
-- directly rather than only proving the grants layer blocks access.
GRANT SELECT ON
  public.quote_requests,
  public.quote_request_invitations,
  public.quote_responses,
  public.quote_response_decisions,
  public.trade_deals,
  public.quote_workflow_idempotency
TO authenticated;

-- Negative: the stranger sees none of the sender/a conversation's rows, across
-- all messaging and RFQ aggregate tables, even when filtered to the exact
-- known ids created above (proves RLS filtering, not an unrelated empty table).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_stranger WHERE slot = 'stranger'))::text, true);

-- conversations/messages have no direct client grants at all (only the
-- SECURITY DEFINER read RPCs do), so access control is exercised through
-- those RPCs rather than a raw table SELECT.
SELECT is(
  (SELECT count(*) FROM jsonb_array_elements(public.list_conversations()) elem
   WHERE (elem->>'id')::uuid = (SELECT conversation_id FROM _m9a_inv)),
  0::bigint,
  'stranger cannot see the sender/a conversation via list_conversations'
);
SELECT throws_ok(
  format($$SELECT public.list_messages(%L::uuid)$$, (SELECT conversation_id FROM _m9a_inv)),
  'P0001',
  'not_authorized',
  'stranger cannot read the sender/a messages via list_messages'
);
SELECT is(
  (SELECT count(*) FROM public.quote_requests WHERE id = (SELECT request_id FROM _m9a_inv)),
  0::bigint,
  'stranger cannot read the RFQ quote request'
);
SELECT is(
  (SELECT count(*) FROM public.quote_request_invitations WHERE id = (SELECT id FROM _m9a_inv)),
  0::bigint,
  'stranger cannot read the RFQ invitation'
);
SELECT is(
  (SELECT count(*) FROM public.quote_responses WHERE id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)),
  0::bigint,
  'stranger cannot read the RFQ response'
);
SELECT is(
  (SELECT count(*) FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)),
  0::bigint,
  'stranger cannot read the RFQ decision'
);
SELECT is(
  (SELECT count(*) FROM public.trade_deals WHERE id = ((SELECT result->'deal'->>'id' FROM _m9a_book)::uuid)),
  0::bigint,
  'stranger cannot read the trade deal'
);
SELECT is(
  (SELECT count(*) FROM public.quote_workflow_idempotency WHERE actor_user_id = (SELECT user_id FROM _m9_users WHERE slot = 'sender')),
  0::bigint,
  'stranger cannot read the sender''s idempotency records'
);

RESET ROLE;

-- Positive: the owner (sender) and the invited recipient (a) can each see
-- their own allowed aggregates, proving the negative tests above are not
-- vacuously true because nobody can see anything.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'sender'))::text, true);

SELECT ok(
  (SELECT count(*) FROM jsonb_array_elements(public.list_conversations()) elem
   WHERE (elem->>'id')::uuid = (SELECT conversation_id FROM _m9a_inv)) = 1,
  'owner can see their own conversation via list_conversations'
);
SELECT ok(
  jsonb_array_length((public.list_messages((SELECT conversation_id FROM _m9a_inv)))->'messages') >= 1,
  'owner can read their own conversation messages via list_messages'
);
SELECT ok(
  (SELECT count(*) FROM public.quote_requests WHERE id = (SELECT request_id FROM _m9a_inv)) = 1,
  'owner can read their own RFQ quote request'
);
SELECT ok(
  (SELECT count(*) FROM public.quote_request_invitations WHERE id = (SELECT id FROM _m9a_inv)) = 1,
  'owner can read their own RFQ invitation'
);
SELECT ok(
  (SELECT count(*) FROM public.quote_responses WHERE id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)) = 1,
  'owner can read the recipient''s response to their RFQ'
);
-- quote_response_decisions and quote_workflow_idempotency have RLS enabled
-- but intentionally carry no SELECT policy at all: they are pure
-- server-side bookkeeping, surfaced to clients only as fields embedded in
-- the RPC response snapshots (e.g. submit/counter/reject/book results), never
-- as directly queryable rows. Confirm that stance holds for the legitimate
-- owner too (not just the stranger above), i.e. this is "deny to everyone by
-- design", not an accidental gap that happens to also block the owner.
SELECT is(
  (SELECT count(*) FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)),
  0::bigint,
  'owner cannot read the decision via a direct table select either (no SELECT policy exists; decisions surface only via RPC snapshots)'
);
SELECT ok(
  (SELECT count(*) FROM public.trade_deals WHERE id = ((SELECT result->'deal'->>'id' FROM _m9a_book)::uuid)) = 1,
  'owner can read their own booked deal'
);
SELECT is(
  (SELECT count(*) FROM public.quote_workflow_idempotency WHERE actor_user_id = (SELECT user_id FROM _m9_users WHERE slot = 'sender')),
  0::bigint,
  'owner cannot read idempotency bookkeeping via a direct table select either (no SELECT policy exists)'
);

RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m9_users WHERE slot = 'a'))::text, true);

SELECT ok(
  (SELECT count(*) FROM public.quote_responses WHERE id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)) = 1,
  'recipient can read their own submitted response'
);
SELECT is(
  (SELECT count(*) FROM public.quote_response_decisions WHERE response_id = ((SELECT result->'response'->>'id' FROM _m9a_submit)::uuid)),
  0::bigint,
  'recipient cannot read the decision via a direct table select either (no SELECT policy exists)'
);
SELECT ok(
  (SELECT count(*) FROM public.trade_deals WHERE id = ((SELECT result->'deal'->>'id' FROM _m9a_book)::uuid)) = 1,
  'recipient can read the deal booked against their response'
);

RESET ROLE;

-- Review fixes: internal SECURITY DEFINER helpers must not be client-callable
SELECT ok(
  NOT has_function_privilege('authenticated', (SELECT oid FROM pg_proc WHERE proname = 'resolve_bilateral_conversation' AND pronamespace = 'public'::regnamespace), 'EXECUTE'),
  'resolve_bilateral_conversation not executable by authenticated'
);
SELECT ok(
  NOT has_function_privilege('anon', (SELECT oid FROM pg_proc WHERE proname = 'create_workflow_message' AND pronamespace = 'public'::regnamespace), 'EXECUTE'),
  'create_workflow_message not executable by anon'
);

-- Review fixes: RFQ aggregate tables must have RLS enabled
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quote_requests'::regclass), 'quote_requests RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quote_request_invitations'::regclass), 'quote_request_invitations RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quote_responses'::regclass), 'quote_responses RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.trade_deals'::regclass), 'trade_deals RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quote_workflow_idempotency'::regclass), 'quote_workflow_idempotency RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quote_response_decisions'::regclass), 'quote_response_decisions RLS enabled');

-- Review fixes: exactly one root response per invitation
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'quote_responses' AND indexname = 'idx_quote_responses_single_root'),
  'single root response partial index exists'
);

-- Finding 9 (6): a second root response for the same invitation is actually
-- rejected by that index, not merely provable by the index's existence.
SELECT throws_ok(
  format(
    $$INSERT INTO public.quote_responses (invitation_id, responder_user_id, parent_response_id, client_response_id, status, quoted_premium)
      VALUES (%L, %L, NULL, gen_random_uuid(), 'submitted', '+0.30')$$,
    (SELECT id FROM _m9a_inv),
    (SELECT user_id FROM _m9_users WHERE slot = 'a')
  ),
  '23505',
  NULL,
  'a second root response for the same invitation is rejected'
);
SELECT is(
  (SELECT count(*) FROM public.quote_responses WHERE invitation_id = (SELECT id FROM _m9a_inv) AND parent_response_id IS NULL),
  1::bigint,
  'exactly one root response remains for the invitation after the rejected insert'
);

SELECT * FROM finish();

ROLLBACK;
