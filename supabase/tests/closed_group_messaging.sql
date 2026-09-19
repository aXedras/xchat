-- Closed-Group Messaging MVP — Database tests (pgTAP)
-- Extends per micro-step M0a, M4, M5, M6, M7, M8, M9, M9a, M10.
-- Executed via `npm run supabase:test` (supabase test db).

BEGIN;

SELECT plan(339);

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

-- M11: delete_conversation (hard delete with activity guard)
SELECT has_function('public', 'delete_conversation', ARRAY['uuid'], 'delete_conversation(uuid) exists');

CREATE TEMP TABLE _m11_users (slot text, user_id uuid);

DO $$
DECLARE
  v_slot text;
  v_id uuid;
BEGIN
  FOREACH v_slot IN ARRAY ARRAY['o1','p1','o2','p2','o3','p3','o4','p4']
  LOOP
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm11-' || v_slot || '@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '')
    RETURNING id INTO v_id;
    INSERT INTO _m11_users VALUES (v_slot, v_id);
  END LOOP;
END $$;

GRANT SELECT ON _m11_users TO authenticated;

-- Simple bilateral conversation (no RFQ) — deletable.
INSERT INTO public.conversations (id, participant_low_user_id, participant_high_user_id)
VALUES (
  '00000000-0000-0000-0000-00000000a001',
  LEAST((SELECT user_id FROM _m11_users WHERE slot = 'o1'), (SELECT user_id FROM _m11_users WHERE slot = 'p1')),
  GREATEST((SELECT user_id FROM _m11_users WHERE slot = 'o1'), (SELECT user_id FROM _m11_users WHERE slot = 'p1'))
);

INSERT INTO public.messages (id, conversation_id, sender_user_id, recipient_user_id, type, content)
VALUES
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a001', (SELECT user_id FROM _m11_users WHERE slot = 'o1'), (SELECT user_id FROM _m11_users WHERE slot = 'p1'), 'standard', 'simple hello'),
  ('00000000-0000-0000-0000-00000000a102', '00000000-0000-0000-0000-00000000a001', (SELECT user_id FROM _m11_users WHERE slot = 'p1'), (SELECT user_id FROM _m11_users WHERE slot = 'o1'), 'standard', 'simple reply');

-- Unanswered RFQ invitation (no response) — deletable; quote_request may orphan.
INSERT INTO public.conversations (id, participant_low_user_id, participant_high_user_id)
VALUES (
  '00000000-0000-0000-0000-00000000b001',
  LEAST((SELECT user_id FROM _m11_users WHERE slot = 'o2'), (SELECT user_id FROM _m11_users WHERE slot = 'p2')),
  GREATEST((SELECT user_id FROM _m11_users WHERE slot = 'o2'), (SELECT user_id FROM _m11_users WHERE slot = 'p2'))
);

INSERT INTO public.quote_requests (id, owner_user_id, terms, status)
VALUES ('00000000-0000-0000-0000-00000000b201', (SELECT user_id FROM _m11_users WHERE slot = 'o2'), '{}'::jsonb, 'open');

INSERT INTO public.messages (id, conversation_id, sender_user_id, recipient_user_id, type, content, quote_request_id)
VALUES ('00000000-0000-0000-0000-00000000b101', '00000000-0000-0000-0000-00000000b001', (SELECT user_id FROM _m11_users WHERE slot = 'o2'), (SELECT user_id FROM _m11_users WHERE slot = 'p2'), 'rfq', 'unanswered rfq', '00000000-0000-0000-0000-00000000b201');

INSERT INTO public.quote_request_invitations (id, request_id, recipient_user_id, conversation_id, message_id)
VALUES ('00000000-0000-0000-0000-00000000b301', '00000000-0000-0000-0000-00000000b201', (SELECT user_id FROM _m11_users WHERE slot = 'p2'), '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b101');

-- RFQ with a submitted response — guarded (conversation_has_activity).
INSERT INTO public.conversations (id, participant_low_user_id, participant_high_user_id)
VALUES (
  '00000000-0000-0000-0000-00000000c001',
  LEAST((SELECT user_id FROM _m11_users WHERE slot = 'o3'), (SELECT user_id FROM _m11_users WHERE slot = 'p3')),
  GREATEST((SELECT user_id FROM _m11_users WHERE slot = 'o3'), (SELECT user_id FROM _m11_users WHERE slot = 'p3'))
);

INSERT INTO public.quote_requests (id, owner_user_id, terms, status)
VALUES ('00000000-0000-0000-0000-00000000c201', (SELECT user_id FROM _m11_users WHERE slot = 'o3'), '{"product":"Gold","quantity":"1KG"}'::jsonb, 'open');

INSERT INTO public.messages (id, conversation_id, sender_user_id, recipient_user_id, type, content, quote_request_id)
VALUES ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001', (SELECT user_id FROM _m11_users WHERE slot = 'o3'), (SELECT user_id FROM _m11_users WHERE slot = 'p3'), 'rfq', 'answered rfq', '00000000-0000-0000-0000-00000000c201');

INSERT INTO public.quote_request_invitations (id, request_id, recipient_user_id, conversation_id, message_id)
VALUES ('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-00000000c201', (SELECT user_id FROM _m11_users WHERE slot = 'p3'), '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c101');

INSERT INTO public.quote_responses (id, invitation_id, responder_user_id, parent_response_id, client_response_id, status, quoted_premium)
VALUES ('00000000-0000-0000-0000-00000000c401', '00000000-0000-0000-0000-00000000c301', (SELECT user_id FROM _m11_users WHERE slot = 'p3'), NULL, '00000000-0000-0000-0000-00000000c901', 'submitted', '+0.20');

-- RFQ with a booked trade deal — guarded (conversation_has_activity).
INSERT INTO public.conversations (id, participant_low_user_id, participant_high_user_id)
VALUES (
  '00000000-0000-0000-0000-00000000d001',
  LEAST((SELECT user_id FROM _m11_users WHERE slot = 'o4'), (SELECT user_id FROM _m11_users WHERE slot = 'p4')),
  GREATEST((SELECT user_id FROM _m11_users WHERE slot = 'o4'), (SELECT user_id FROM _m11_users WHERE slot = 'p4'))
);

INSERT INTO public.quote_requests (id, owner_user_id, terms, status)
VALUES ('00000000-0000-0000-0000-00000000d201', (SELECT user_id FROM _m11_users WHERE slot = 'o4'), '{"product":"Gold","quantity":"1KG"}'::jsonb, 'open');

INSERT INTO public.messages (id, conversation_id, sender_user_id, recipient_user_id, type, content, quote_request_id)
VALUES ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d001', (SELECT user_id FROM _m11_users WHERE slot = 'o4'), (SELECT user_id FROM _m11_users WHERE slot = 'p4'), 'rfq', 'booked rfq', '00000000-0000-0000-0000-00000000d201');

INSERT INTO public.quote_request_invitations (id, request_id, recipient_user_id, conversation_id, message_id)
VALUES ('00000000-0000-0000-0000-00000000d301', '00000000-0000-0000-0000-00000000d201', (SELECT user_id FROM _m11_users WHERE slot = 'p4'), '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d101');

INSERT INTO public.quote_responses (id, invitation_id, responder_user_id, parent_response_id, client_response_id, status, quoted_premium)
VALUES ('00000000-0000-0000-0000-00000000d401', '00000000-0000-0000-0000-00000000d301', (SELECT user_id FROM _m11_users WHERE slot = 'p4'), NULL, '00000000-0000-0000-0000-00000000d901', 'submitted', '+0.20');

INSERT INTO public.trade_deals (id, request_id, response_id, counterparty_user_id, booked_by_user_id, booking_client_action_id, product, volume, status, commercial_terms_snapshot)
VALUES ('00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-00000000d401', (SELECT user_id FROM _m11_users WHERE slot = 'p4'), (SELECT user_id FROM _m11_users WHERE slot = 'o4'), '00000000-0000-0000-0000-00000000d902', 'Gold', '1KG', 'booked', '{}'::jsonb);

-- Unauthenticated: no JWT claim present → unauthenticated.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '', true);

SELECT throws_ok(
  $$SELECT public.delete_conversation('00000000-0000-0000-0000-00000000a001'::uuid)$$,
  'P0001',
  'unauthenticated',
  'delete_conversation without a session raises unauthenticated'
);

RESET ROLE;

-- Non-participant of an existing conversation → not_authorized (no existence leak).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m11_users WHERE slot = 'o3'))::text, true);

SELECT throws_ok(
  $$SELECT public.delete_conversation('00000000-0000-0000-0000-00000000a001'::uuid)$$,
  'P0001',
  'not_authorized',
  'a non-participant cannot delete another pair''s conversation'
);

RESET ROLE;

-- Non-existent conversation id → identical not_authorized code.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m11_users WHERE slot = 'o1'))::text, true);

SELECT throws_ok(
  $$SELECT public.delete_conversation('00000000-0000-0000-0000-00000000ffff'::uuid)$$,
  'P0001',
  'not_authorized',
  'a non-existent conversation id raises the same not_authorized code'
);

RESET ROLE;

-- Participant deletes the simple conversation (no RFQ) — success, rows gone.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m11_users WHERE slot = 'o1'))::text, true);

SELECT is(
  (SELECT public.delete_conversation('00000000-0000-0000-0000-00000000a001'::uuid)),
  jsonb_build_object('ok', true),
  'a participant can delete a simple conversation'
);

RESET ROLE;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = '00000000-0000-0000-0000-00000000a001'),
  'simple conversation is deleted'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = '00000000-0000-0000-0000-00000000a001'),
  'simple conversation messages are deleted'
);

-- Double delete of the same conversation → not_authorized (row no longer exists).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m11_users WHERE slot = 'o1'))::text, true);

SELECT throws_ok(
  $$SELECT public.delete_conversation('00000000-0000-0000-0000-00000000a001'::uuid)$$,
  'P0001',
  'not_authorized',
  'deleting an already-deleted conversation raises not_authorized'
);

RESET ROLE;

-- Unanswered RFQ invitation does not block deletion; invitation is removed,
-- the quote_request intentionally remains (orphaned).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m11_users WHERE slot = 'o2'))::text, true);

SELECT is(
  (SELECT public.delete_conversation('00000000-0000-0000-0000-00000000b001'::uuid)),
  jsonb_build_object('ok', true),
  'a participant can delete a conversation with an unanswered RFQ invitation'
);

RESET ROLE;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.quote_request_invitations WHERE conversation_id = '00000000-0000-0000-0000-00000000b001'),
  'unanswered RFQ invitation is deleted with the conversation'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.quote_requests WHERE id = '00000000-0000-0000-0000-00000000b201'),
  'quote_request survives the conversation delete (may orphan)'
);

-- Submitted RFQ response blocks deletion; all related rows remain untouched.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m11_users WHERE slot = 'o3'))::text, true);

SELECT throws_ok(
  $$SELECT public.delete_conversation('00000000-0000-0000-0000-00000000c001'::uuid)$$,
  'P0001',
  'conversation_has_activity',
  'a conversation with a submitted RFQ response cannot be deleted'
);

RESET ROLE;

SELECT ok(
  EXISTS (SELECT 1 FROM public.conversations WHERE id = '00000000-0000-0000-0000-00000000c001'),
  'guarded conversation remains after the refused delete'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = '00000000-0000-0000-0000-00000000c001'),
  'guarded conversation messages remain after the refused delete'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.quote_request_invitations WHERE conversation_id = '00000000-0000-0000-0000-00000000c001'),
  'guarded RFQ invitation remains after the refused delete'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.quote_responses WHERE id = '00000000-0000-0000-0000-00000000c401'),
  'guarded RFQ response remains after the refused delete'
);

-- Booked trade deal blocks deletion; the deal row remains untouched.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _m11_users WHERE slot = 'o4'))::text, true);

SELECT throws_ok(
  $$SELECT public.delete_conversation('00000000-0000-0000-0000-00000000d001'::uuid)$$,
  'P0001',
  'conversation_has_activity',
  'a conversation with a booked trade deal cannot be deleted'
);

RESET ROLE;

SELECT ok(
  EXISTS (SELECT 1 FROM public.trade_deals WHERE id = '00000000-0000-0000-0000-00000000d501'),
  'booked trade deal remains after the refused delete'
);

-- ============================================
-- P2: Organizations, capabilities, memberships, roles, entitlements
-- ============================================

SELECT has_table('public', 'organizations', 'organizations table exists');
SELECT has_table('public', 'organization_capabilities', 'organization_capabilities table exists');
SELECT has_table('public', 'organization_units', 'organization_units table exists');
SELECT has_table('public', 'organization_memberships', 'organization_memberships table exists');
SELECT has_table('public', 'platform_roles', 'platform_roles table exists');
SELECT has_table('public', 'platform_entitlements', 'platform_entitlements table exists');
SELECT has_table('public', 'platform_role_entitlements', 'platform_role_entitlements table exists');
SELECT has_table('public', 'user_platform_roles', 'user_platform_roles table exists');
SELECT has_table('public', 'feature_flags', 'feature_flags table exists');

SELECT has_function('public', 'current_organization_membership', ARRAY[]::text[], 'current_organization_membership() exists');
SELECT has_function('public', 'has_entitlement', ARRAY['text'], 'has_entitlement(text) exists');
SELECT has_function('public', 'organization_has_capability', ARRAY['uuid', 'text'], 'organization_has_capability(uuid,text) exists');
SELECT has_function('public', 'get_my_trading_context', ARRAY[]::text[], 'get_my_trading_context() exists');
SELECT has_function('public', 'list_trading_participants', ARRAY[]::text[], 'list_trading_participants() exists');
SELECT has_function('public', 'admin_list_organizations', ARRAY[]::text[], 'admin_list_organizations() exists');
SELECT has_function('public', 'admin_create_organization', ARRAY['text','text','text','text','text','text'], 'admin_create_organization(...) exists');
SELECT has_function('public', 'admin_set_organization_capability', ARRAY['uuid','text','text'], 'admin_set_organization_capability(...) exists');
SELECT has_function('public', 'admin_create_organization_unit', ARRAY['uuid','uuid','text','text'], 'admin_create_organization_unit(...) exists');
SELECT has_function('public', 'admin_assign_membership', ARRAY['uuid','uuid','uuid','text'], 'admin_assign_membership(...) exists');
SELECT has_function('public', 'admin_assign_user_role', ARRAY['uuid','text','uuid'], 'admin_assign_user_role(...) exists');

SELECT ok(
  (SELECT bool_and(relrowsecurity)
   FROM pg_class
   WHERE oid IN (
     'public.organizations'::regclass,
     'public.organization_capabilities'::regclass,
     'public.organization_units'::regclass,
     'public.organization_memberships'::regclass,
     'public.platform_roles'::regclass,
     'public.platform_entitlements'::regclass,
     'public.platform_role_entitlements'::regclass,
     'public.user_platform_roles'::regclass,
     'public.feature_flags'::regclass
   )),
  'all organization tables have RLS enabled'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.organizations (legal_name, display_name) VALUES ('X Corp', 'X')$$,
  '42501',
  NULL,
  'authenticated cannot INSERT organizations'
);
SELECT throws_ok(
  $$INSERT INTO public.organization_memberships (user_id, organization_id) VALUES ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501',
  NULL,
  'authenticated cannot INSERT organization_memberships'
);
RESET ROLE;

-- Capability code and membership validity shape checks.
SELECT throws_ok(
  $$INSERT INTO public.organization_capabilities (organization_id, capability_code) VALUES ('20000000-0000-0000-0000-000000000001'::uuid, 'BOGUS')$$,
  '23514',
  NULL,
  'invalid capability code rejected'
);
SELECT throws_ok(
  $$INSERT INTO public.organization_memberships (user_id, organization_id, valid_from, valid_until) VALUES ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, now(), now() - interval '1 day')$$,
  '23514',
  NULL,
  'membership with valid_until before valid_from rejected'
);

CREATE TEMP TABLE _p2_users (slot text, user_id uuid);
CREATE TEMP TABLE _p2_orgs (slot text, org_id uuid);

DO $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.organizations (id, legal_name, display_name, status, source_system)
  VALUES (gen_random_uuid(), 'Org A AG', 'Org A', 'active', 'xchat') RETURNING id INTO v_id;
  INSERT INTO _p2_orgs VALUES ('a', v_id);

  INSERT INTO public.organizations (id, legal_name, display_name, status, source_system)
  VALUES (gen_random_uuid(), 'Org B AG', 'Org B', 'active', 'xchat') RETURNING id INTO v_id;
  INSERT INTO _p2_orgs VALUES ('b', v_id);

  INSERT INTO public.organizations (id, legal_name, display_name, status, source_system)
  VALUES (gen_random_uuid(), 'Org Inactive AG', 'Org Inactive', 'active', 'xchat') RETURNING id INTO v_id;
  INSERT INTO _p2_orgs VALUES ('inactive', v_id);

  INSERT INTO public.organization_capabilities (organization_id, capability_code, status, valid_from)
  VALUES ((SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'MINE_OPERATOR', 'active', now());

  INSERT INTO public.organization_capabilities (organization_id, capability_code, status, valid_from)
  VALUES ((SELECT org_id FROM _p2_orgs WHERE slot = 'b'), 'REFINER', 'active', now());

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p2-alice@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P2 Alice"}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _p2_users VALUES ('alice', v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p2-bob@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P2 Bob"}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _p2_users VALUES ('bob', v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p2-eve@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P2 Eve"}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _p2_users VALUES ('eve', v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p2-inactive@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P2 Inactive"}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _p2_users VALUES ('inactive', v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p2-inactive-org@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P2 Inactive Org"}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _p2_users VALUES ('inactive_org', v_id);

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p2-admin@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P2 Admin"}'::jsonb, now(), now(), '', '')
  RETURNING id INTO v_id;
  INSERT INTO _p2_users VALUES ('admin', v_id);

  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'alice'), (SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'bob'), (SELECT org_id FROM _p2_orgs WHERE slot = 'b'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'eve'), (SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'inactive'), (SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'inactive', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'inactive_org'), (SELECT org_id FROM _p2_orgs WHERE slot = 'inactive'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'admin'), (SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'active', now());

  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'alice'), 'TRADER', (SELECT org_id FROM _p2_orgs WHERE slot = 'a'), now());
  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'bob'), 'SALES', (SELECT org_id FROM _p2_orgs WHERE slot = 'b'), now());
  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'admin'), 'PLATFORM_ADMIN', NULL, now());

  -- Deactivate the inactive organization after its membership was inserted, so
  -- the membership is active but its organization is no longer active.
  UPDATE public.organizations SET status = 'inactive'
  WHERE id = (SELECT org_id FROM _p2_orgs WHERE slot = 'inactive');
END $$;

GRANT SELECT ON _p2_users TO authenticated;
GRANT SELECT ON _p2_orgs TO authenticated;

-- P2-034: at most one active membership per user.
SELECT throws_ok(
  $$INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from) VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'alice'), (SELECT org_id FROM _p2_orgs WHERE slot = 'b'), 'active', now())$$,
  '23505',
  NULL,
  'a second active membership for the same user is rejected'
);

SELECT lives_ok(
  $$INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from) VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'alice'), (SELECT org_id FROM _p2_orgs WHERE slot = 'b'), 'inactive', now())$$,
  'an inactive membership for the same user may be inserted (history preserved)'
);

-- P2-035: cross-organization unit parent is rejected.
INSERT INTO public.organization_units (organization_id, unit_type, name)
VALUES ((SELECT org_id FROM _p2_orgs WHERE slot = 'b'), 'desk', 'Org B Desk');

SELECT throws_ok(
  $$INSERT INTO public.organization_units (organization_id, parent_unit_id, unit_type, name)
    VALUES (
      (SELECT org_id FROM _p2_orgs WHERE slot = 'a'),
      (SELECT id FROM public.organization_units WHERE name = 'Org B Desk'),
      'desk', 'Org A Desk'
    )$$,
  'P0001',
  'cross_organization_unit_parent',
  'cross-organization unit parent is rejected'
);

-- Active membership requires an active organization.
SELECT throws_ok(
  $$INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from) VALUES ((SELECT user_id FROM _p2_users WHERE slot = 'alice'), (SELECT org_id FROM _p2_orgs WHERE slot = 'inactive'), 'active', now())$$,
  'P0001',
  'inactive_organization',
  'active membership to an inactive organization is rejected'
);

-- P2-036: inactive users and inactive organizations are excluded from the directory.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p2_users WHERE slot = 'alice'))::text, true);

CREATE TEMP TABLE _p2_dir AS
SELECT public.list_trading_participants() AS result;

RESET ROLE;

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT result FROM _p2_dir)) e
    WHERE e->>'displayName' = 'P2 Alice'
  ),
  'directory excludes the requester themself'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT result FROM _p2_dir)) e
    WHERE e->>'displayName' = 'P2 Inactive'
  ),
  'directory excludes users with an inactive membership'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT result FROM _p2_dir)) e
    WHERE e->>'displayName' = 'P2 Inactive Org'
  ),
  'directory excludes members of inactive organizations'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT result FROM _p2_dir)) e
    WHERE e->>'displayName' = 'P2 Bob'
  ),
  'directory includes active members of other active organizations'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT result FROM _p2_dir)) e
    WHERE e->>'organizationName' = 'Org B' AND e->'capabilities' ? 'REFINER'
  ),
  'directory exposes organization name and capabilities'
);

-- P2-037: a user without entitlement cannot run admin RPCs.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p2_users WHERE slot = 'eve'))::text, true);

SELECT throws_ok(
  $$SELECT public.admin_list_organizations()$$,
  'P0001',
  'not_authorized',
  'user without entitlement cannot list organizations'
);
SELECT throws_ok(
  $$SELECT public.admin_create_organization('X Corp', 'X', NULL, NULL, 'CH', 'active')$$,
  'P0001',
  'not_authorized',
  'user without entitlement cannot create an organization'
);

RESET ROLE;

-- Positive: trading context, entitlement and capability checks as a trader.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p2_users WHERE slot = 'alice'))::text, true);

SELECT is(
  public.get_my_trading_context()->'membership'->>'organizationName',
  'Org A',
  'trading context returns the active membership organization'
);
SELECT ok(
  public.get_my_trading_context()->'capabilities' ? 'MINE_OPERATOR',
  'trading context returns the organization capabilities'
);
SELECT ok(
  public.get_my_trading_context()->'entitlements' ? 'RFQ_CREATE',
  'trading context returns trader entitlements'
);
SELECT ok(
  public.has_entitlement('RFQ_CREATE'),
  'trader has RFQ_CREATE'
);
SELECT ok(
  NOT public.has_entitlement('ORG_CAPABILITIES_MANAGE'),
  'trader lacks ORG_CAPABILITIES_MANAGE'
);
SELECT ok(
  public.organization_has_capability((SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'MINE_OPERATOR'),
  'organization_has_capability returns true for an active capability'
);
SELECT ok(
  NOT public.organization_has_capability((SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'REFINER'),
  'organization_has_capability returns false for a missing capability'
);

RESET ROLE;

-- Positive: platform admin can manage organizations and capabilities.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p2_users WHERE slot = 'admin'))::text, true);

SELECT ok(
  jsonb_array_length(public.admin_list_organizations()) >= 3,
  'platform admin lists all organizations'
);

SELECT is(
  public.admin_set_organization_capability(
    (SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'REFINER', 'active'
  )->>'ok',
  'true',
  'platform admin can add an organization capability'
);
SELECT ok(
  public.organization_has_capability((SELECT org_id FROM _p2_orgs WHERE slot = 'a'), 'REFINER'),
  'newly added capability is active'
);

RESET ROLE;

-- ============================================
-- P4: RFQ data model V2 and secure dispatch
-- ============================================

SELECT has_table('public', 'quote_request_events', 'quote_request_events table exists');
SELECT has_function('public', 'normalize_rfq_terms_v2', ARRAY['jsonb','text'], 'normalize_rfq_terms_v2(jsonb,text) exists');
SELECT has_function('public', 'validate_quote_request', ARRAY['jsonb','text'], 'validate_quote_request(jsonb,text) exists');
SELECT has_function('public', 'list_available_transaction_types', ARRAY[]::text[], 'list_available_transaction_types() exists');
SELECT has_function('public', 'create_and_dispatch_quote_request_v2', ARRAY['jsonb'], 'create_and_dispatch_quote_request_v2(jsonb) exists');
SELECT has_function('public', 'get_quote_request_projection', ARRAY['uuid'], 'get_quote_request_projection(uuid) exists');
SELECT has_function('public', 'get_quote_invitation_projection', ARRAY['uuid'], 'get_quote_invitation_projection(uuid) exists');
SELECT has_function('public', 'mark_quote_invitation_viewed', ARRAY['uuid'], 'mark_quote_invitation_viewed(uuid) exists');
SELECT has_function('public', 'cancel_quote_request', ARRAY['uuid'], 'cancel_quote_request(uuid) exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quote_request_events'::regclass),
  'quote_request_events has RLS enabled'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.quote_request_events (request_id, actor_user_id, event_type) VALUES ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'x')$$,
  '42501',
  NULL,
  'authenticated cannot INSERT quote_request_events'
);
RESET ROLE;

SELECT throws_ok(
  $$SELECT public.normalize_rfq_terms_v2(jsonb_build_object('schemaVersion',1,'commercial','{}'::jsonb,'material','{}'::jsonb,'assay','{}'::jsonb,'logistics','{}'::jsonb,'sneaky','x'), 'SELL_DORE')$$,
  'P0001',
  'invalid_rfq_terms',
  'unknown root key is rejected'
);
SELECT throws_ok(
  $$SELECT public.normalize_rfq_terms_v2(jsonb_build_object('schemaVersion',1,'commercial',jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false,'sneaky','x'),'material',jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','1.5','quantityUnit','KG'),'assay',jsonb_build_object('assayStatus','PROVISIONAL'),'logistics',jsonb_build_object('currentLocation',jsonb_build_object('countryCode','CH','locality','Zurich'),'availabilityFrom',now())), 'SELL_DORE')$$,
  'P0001',
  'invalid_rfq_terms',
  'unknown commercial tab key is rejected'
);
SELECT throws_ok(
  $$SELECT public.normalize_rfq_terms_v2(jsonb_build_object('schemaVersion',1,'commercial',jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()-interval '1 day'),'partialFulfilmentAllowed',false),'material',jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','1.5','quantityUnit','KG'),'assay',jsonb_build_object('assayStatus','PROVISIONAL'),'logistics',jsonb_build_object('currentLocation',jsonb_build_object('countryCode','CH','locality','Zurich'),'availabilityFrom',now())), 'SELL_DORE')$$,
  'P0001',
  'invalid_deadline',
  'a past deadline is rejected'
);
SELECT throws_ok(
  $$SELECT public.normalize_rfq_terms_v2(jsonb_build_object('schemaVersion',1,'commercial',jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',true),'material',jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','1.5','quantityUnit','KG'),'assay',jsonb_build_object('assayStatus','PROVISIONAL'),'logistics',jsonb_build_object('currentLocation',jsonb_build_object('countryCode','CH','locality','Zurich'),'availabilityFrom',now())), 'SELL_DORE')$$,
  'P0001',
  'partial_fulfilment_not_allowed',
  'partial fulfilment is rejected in Release 1'
);
SELECT throws_ok(
  $$SELECT public.normalize_rfq_terms_v2(jsonb_build_object('schemaVersion',1,'commercial',jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),'material',jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','-1','quantityUnit','KG'),'assay',jsonb_build_object('assayStatus','PROVISIONAL'),'logistics',jsonb_build_object('currentLocation',jsonb_build_object('countryCode','CH','locality','Zurich'),'availabilityFrom',now())), 'SELL_DORE')$$,
  'P0001',
  'invalid_rfq_terms',
  'a non-positive quantity is rejected'
);

CREATE TEMP TABLE _p4_users (slot text, user_id uuid);
CREATE TEMP TABLE _p4_orgs (slot text, org_id uuid);
CREATE TEMP TABLE _p4_created (transaction_type text, request_id uuid);

DO $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.organizations (id, legal_name, display_name, status, source_system)
  VALUES (gen_random_uuid(), 'P4 Org A', 'P4 Org A', 'active', 'xchat') RETURNING id INTO v_id;
  INSERT INTO _p4_orgs VALUES ('a', v_id);
  INSERT INTO public.organizations (id, legal_name, display_name, status, source_system)
  VALUES (gen_random_uuid(), 'P4 Org B', 'P4 Org B', 'active', 'xchat') RETURNING id INTO v_id;
  INSERT INTO _p4_orgs VALUES ('b', v_id);
  INSERT INTO public.organizations (id, legal_name, display_name, status, source_system)
  VALUES (gen_random_uuid(), 'P4 Org C', 'P4 Org C', 'active', 'xchat') RETURNING id INTO v_id;
  INSERT INTO _p4_orgs VALUES ('c', v_id);

  INSERT INTO public.organization_capabilities (organization_id, capability_code, status, valid_from)
  VALUES ((SELECT org_id FROM _p4_orgs WHERE slot = 'a'), 'MINE_OPERATOR', 'active', now());
  INSERT INTO public.organization_capabilities (organization_id, capability_code, status, valid_from)
  VALUES ((SELECT org_id FROM _p4_orgs WHERE slot = 'b'), 'REFINER', 'active', now());
  INSERT INTO public.organization_capabilities (organization_id, capability_code, status, valid_from)
  VALUES ((SELECT org_id FROM _p4_orgs WHERE slot = 'c'), 'REFINER', 'active', now());

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p4-requester@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P4 Requester"}'::jsonb, now(), now(), '', '') RETURNING id INTO v_id;
  INSERT INTO _p4_users VALUES ('requester', v_id);
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p4-bob@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P4 Bob"}'::jsonb, now(), now(), '', '') RETURNING id INTO v_id;
  INSERT INTO _p4_users VALUES ('bob', v_id);
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p4-carol@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P4 Carol"}'::jsonb, now(), now(), '', '') RETURNING id INTO v_id;
  INSERT INTO _p4_users VALUES ('carol', v_id);
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p4-alex@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P4 Alex"}'::jsonb, now(), now(), '', '') RETURNING id INTO v_id;
  INSERT INTO _p4_users VALUES ('alex', v_id);
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'p4-viewer@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"P4 Viewer"}'::jsonb, now(), now(), '', '') RETURNING id INTO v_id;
  INSERT INTO _p4_users VALUES ('viewer', v_id);

  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'requester'), (SELECT org_id FROM _p4_orgs WHERE slot = 'a'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'bob'), (SELECT org_id FROM _p4_orgs WHERE slot = 'b'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'carol'), (SELECT org_id FROM _p4_orgs WHERE slot = 'c'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'alex'), (SELECT org_id FROM _p4_orgs WHERE slot = 'b'), 'active', now());
  INSERT INTO public.organization_memberships (user_id, organization_id, status, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'viewer'), (SELECT org_id FROM _p4_orgs WHERE slot = 'a'), 'active', now());

  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'requester'), 'TRADER', (SELECT org_id FROM _p4_orgs WHERE slot = 'a'), now());
  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'bob'), 'SALES', (SELECT org_id FROM _p4_orgs WHERE slot = 'b'), now());
  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'carol'), 'TRADER', (SELECT org_id FROM _p4_orgs WHERE slot = 'c'), now());
  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'alex'), 'VIEWER', (SELECT org_id FROM _p4_orgs WHERE slot = 'b'), now());
  INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
  VALUES ((SELECT user_id FROM _p4_users WHERE slot = 'viewer'), 'VIEWER', (SELECT org_id FROM _p4_orgs WHERE slot = 'a'), now());
END $$;

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);

SELECT is(
  jsonb_array_length(public.list_available_transaction_types()),
  7,
  'list_available_transaction_types returns seven types'
);

DO $$
DECLARE
  v_types text[] := ARRAY['REFINE_AND_RETURN','SELL_DORE','REFINE_AND_SELL','BUY_REFINED_METAL','SELL_REFINED_METAL','FABRICATE_METAL','BUY_FEEDSTOCK'];
  v_t text;
  v_i int := 0;
  v_result jsonb;
BEGIN
  FOREACH v_t IN ARRAY v_types LOOP
    v_i := v_i + 1;
    v_result := public.create_and_dispatch_quote_request_v2(jsonb_build_object(
      'clientOperationId', ('00000000-0000-0000-0000-00000000e1' || lpad(v_i::text, 2, '0'))::uuid,
      'transactionType', v_t,
      'recipientIds', jsonb_build_array((SELECT user_id FROM _p4_users WHERE slot = 'bob')::text),
      'terms', jsonb_build_object(
        'schemaVersion', 1,
        'commercial', jsonb_build_object('transactionType', v_t, 'responseDeadline', (now() + interval '1 day'), 'partialFulfilmentAllowed', false),
        'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','1.5','quantityUnit','KG'),
        'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
        'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
      )
    ));
    INSERT INTO _p4_created VALUES (v_t, (v_result->>'quoteRequestId')::uuid);
  END LOOP;
END $$;

SELECT is(
  (SELECT count(*) FROM _p4_created),
  7::bigint,
  'seven RFQs were created (one per transaction type)'
);
SELECT results_eq(
  $$SELECT transaction_type FROM _p4_created ORDER BY transaction_type$$,
  $$VALUES ('BUY_FEEDSTOCK'),('BUY_REFINED_METAL'),('FABRICATE_METAL'),('REFINE_AND_RETURN'),('REFINE_AND_SELL'),('SELL_DORE'),('SELL_REFINED_METAL')$$,
  'all seven transaction types were dispatched'
);
SELECT ok(
  (SELECT bool_and(schema_version = 1 AND requester_organization_id = (SELECT org_id FROM _p4_orgs WHERE slot = 'a'))
   FROM public.quote_requests WHERE id IN (SELECT request_id FROM _p4_created)),
  'V2 RFQs carry schema_version 1 and the derived requester organization'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p4_foreign AS
SELECT public.create_and_dispatch_quote_request_v2(jsonb_build_object(
  'clientOperationId', '00000000-0000-0000-0000-00000000e200'::uuid,
  'transactionType', 'SELL_DORE',
  'requesterOrganizationId', (SELECT org_id FROM _p4_orgs WHERE slot = 'c'),
  'recipientIds', jsonb_build_array((SELECT user_id FROM _p4_users WHERE slot = 'bob')::text),
  'terms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),
    'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','1.5','quantityUnit','KG'),
    'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
    'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
  )
)) AS result;

SELECT is(
  (SELECT requester_organization_id FROM public.quote_requests WHERE id = (SELECT (result->>'quoteRequestId')::uuid FROM _p4_foreign)),
  (SELECT org_id FROM _p4_orgs WHERE slot = 'a'),
  'client-supplied organization id is ignored; server derives the requester organization'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p4_multi AS
SELECT public.create_and_dispatch_quote_request_v2(jsonb_build_object(
  'clientOperationId', '00000000-0000-0000-0000-00000000e300'::uuid,
  'transactionType', 'SELL_DORE',
  'recipientIds', jsonb_build_array(
    (SELECT user_id FROM _p4_users WHERE slot = 'bob')::text,
    (SELECT user_id FROM _p4_users WHERE slot = 'carol')::text
  ),
  'terms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),
    'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','3','quantityUnit','KG'),
    'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
    'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
  )
)) AS result;

CREATE TEMP TABLE _p4_multi_ids AS
SELECT (result->>'quoteRequestId')::uuid AS request_id FROM _p4_multi;

SELECT is(
  (SELECT result->'dispatch'->>'status' FROM _p4_multi),
  'completed',
  'multi-recipient dispatch completes'
);
SELECT is(
  (SELECT count(*) FROM public.quote_request_invitations WHERE request_id = (SELECT request_id FROM _p4_multi_ids)),
  2::bigint,
  'two invitations are created for two recipients'
);
SELECT is(
  (SELECT count(*) FROM public.messages WHERE quote_request_id = (SELECT request_id FROM _p4_multi_ids)),
  2::bigint,
  'two messages are created for two recipients'
);
SELECT ok(
  (SELECT bool_and(recipient_organization_id IS NOT NULL)
   FROM public.quote_request_invitations WHERE request_id = (SELECT request_id FROM _p4_multi_ids)),
  'recipient organization ids are recorded on invitations'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p4_replay AS
SELECT public.create_and_dispatch_quote_request_v2(jsonb_build_object(
  'clientOperationId', '00000000-0000-0000-0000-00000000e300'::uuid,
  'transactionType', 'SELL_DORE',
  'recipientIds', jsonb_build_array(
    (SELECT user_id FROM _p4_users WHERE slot = 'bob')::text,
    (SELECT user_id FROM _p4_users WHERE slot = 'carol')::text
  ),
  'terms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),
    'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','3','quantityUnit','KG'),
    'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
    'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
  )
)) AS result;

SELECT is(
  (SELECT (result->>'quoteRequestId')::uuid FROM _p4_replay),
  (SELECT request_id FROM _p4_multi_ids),
  'idempotent replay returns the same quote request id'
);
SELECT is(
  (SELECT count(*) FROM public.quote_requests WHERE id = (SELECT request_id FROM _p4_multi_ids)),
  1::bigint,
  'idempotent replay does not create a duplicate RFQ'
);

SELECT throws_ok(
  $$SELECT public.create_and_dispatch_quote_request_v2(jsonb_build_object(
    'clientOperationId', '00000000-0000-0000-0000-00000000e300'::uuid,
    'transactionType', 'SELL_DORE',
    'recipientIds', jsonb_build_array((SELECT user_id FROM _p4_users WHERE slot = 'bob')::text),
    'terms', jsonb_build_object(
      'schemaVersion', 1,
      'commercial', jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),
      'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','999','quantityUnit','KG'),
      'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
      'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
    )
  ))$$,
  'P0001',
  'idempotency_payload_mismatch',
  'a different payload with the same operation id is rejected'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
SELECT throws_ok(
  $$SELECT public.get_quote_request_projection((SELECT request_id FROM _p4_multi_ids))$$,
  'P0001',
  'not_authorized',
  'a sibling recipient cannot read the requester projection'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
SELECT throws_ok(
  $$SELECT public.get_quote_invitation_projection((SELECT i.id FROM public.quote_request_invitations i WHERE i.request_id = (SELECT request_id FROM _p4_multi_ids) AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'carol')))$$,
  'P0001',
  'not_authorized',
  'a recipient cannot read a sibling recipient invitation'
);
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'alex'))::text, true);
SELECT throws_ok(
  $$SELECT public.get_quote_invitation_projection((SELECT i.id FROM public.quote_request_invitations i WHERE i.request_id = (SELECT request_id FROM _p4_multi_ids) AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'bob')))$$,
  'P0001',
  'not_authorized',
  'a same-organization non-recipient cannot read the invitation'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
SELECT ok(
  NOT (public.get_quote_invitation_projection((SELECT i.id FROM public.quote_request_invitations i WHERE i.request_id = (SELECT request_id FROM _p4_multi_ids) AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'bob'))) ? 'invitations'),
  'recipient projection does not expose sibling invitations'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
CREATE TEMP TABLE _p4_bob_inv AS
SELECT i.id FROM public.quote_request_invitations i
WHERE i.request_id = (SELECT request_id FROM _p4_multi_ids)
  AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'bob');

SELECT is(
  public.mark_quote_invitation_viewed((SELECT id FROM _p4_bob_inv))->>'ok',
  'true',
  'recipient can mark their invitation viewed'
);
SELECT is(
  (SELECT status FROM public.quote_request_invitations WHERE id = (SELECT id FROM _p4_bob_inv)),
  'viewed',
  'invitation status becomes viewed'
);

CREATE TEMP TABLE _p4_first_view AS
SELECT first_viewed_at FROM public.quote_request_invitations WHERE id = (SELECT id FROM _p4_bob_inv);
SELECT is(
  public.mark_quote_invitation_viewed((SELECT id FROM _p4_bob_inv))->>'ok',
  'true',
  'marking viewed is idempotent'
);
SELECT is(
  (SELECT first_viewed_at FROM public.quote_request_invitations WHERE id = (SELECT id FROM _p4_bob_inv)),
  (SELECT first_viewed_at FROM _p4_first_view),
  'first_viewed_at is write-once'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT is(
  public.cancel_quote_request((SELECT request_id FROM _p4_multi_ids))->>'ok',
  'true',
  'the owner can cancel an open RFQ'
);
SELECT is(
  (SELECT status FROM public.quote_requests WHERE id = (SELECT request_id FROM _p4_multi_ids)),
  'cancelled',
  'the cancelled RFQ is marked cancelled'
);
SELECT is(
  (SELECT count(*) FROM public.quote_request_invitations WHERE request_id = (SELECT request_id FROM _p4_multi_ids) AND status = 'closed'),
  2::bigint,
  'all invitations are closed on cancel'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
SELECT throws_ok(
  $$SELECT public.cancel_quote_request((SELECT request_id FROM _p4_multi_ids))$$,
  'P0001',
  'not_authorized',
  'a non-owner cannot cancel the RFQ'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'viewer'))::text, true);
SELECT throws_ok(
  $$SELECT public.create_and_dispatch_quote_request_v2(jsonb_build_object(
    'clientOperationId', gen_random_uuid(),
    'transactionType', 'SELL_DORE',
    'recipientIds', jsonb_build_array((SELECT user_id FROM _p4_users WHERE slot = 'bob')::text),
    'terms', jsonb_build_object(
      'schemaVersion', 1,
      'commercial', jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),
      'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','1.5','quantityUnit','KG'),
      'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
      'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
    )
  ))$$,
  'P0001',
  'not_authorized',
  'a user without RFQ_CREATE cannot create an RFQ'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P7: Quotation V2, counter offers, pricing components
-- ============================================

SELECT has_table('public', 'quote_pricing_components', 'quote_pricing_components table exists');
SELECT has_function('public', 'normalize_quote_response_v2', ARRAY['jsonb'], 'normalize_quote_response_v2(jsonb) exists');
SELECT has_function('public', 'submit_quote_response_v2', ARRAY['jsonb'], 'submit_quote_response_v2(jsonb) exists');
SELECT has_function('public', 'counter_quote_response_v2', ARRAY['jsonb'], 'counter_quote_response_v2(jsonb) exists');
SELECT has_function('public', 'withdraw_quote_response', ARRAY['uuid'], 'withdraw_quote_response(uuid) exists');
SELECT has_function('public', 'decline_quote_invitation', ARRAY['uuid'], 'decline_quote_invitation(uuid) exists');
SELECT has_function('public', 'reject_quote_response_v2', ARRAY['jsonb'], 'reject_quote_response_v2(jsonb) exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quote_pricing_components'::regclass),
  'quote_pricing_components has RLS enabled'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.quote_pricing_components (response_id, sequence_no, component_type, label, calculation_method, charge_direction) VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 1, 'PREMIUM', 'x', 'FIXED_AMOUNT', 'PAYABLE_BY_REQUESTER')$$,
  '42501',
  NULL,
  'authenticated cannot INSERT quote_pricing_components'
);
RESET ROLE;

-- Quotation validation rejects malformed payloads.
SELECT throws_ok(
  $$SELECT public.normalize_quote_response_v2(jsonb_build_object('schemaVersion',1,'commercial',jsonb_build_object('validUntil',(now()+interval '1 day')),'pricingComponents',jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','x','calculationMethod','FIXED_AMOUNT','chargeDirection','PAYABLE_BY_REQUESTER'))))$$,
  'P0001',
  'invalid_quote_payload',
  'a numeric calculation method without numericValue is rejected'
);
SELECT throws_ok(
  $$SELECT public.normalize_quote_response_v2(jsonb_build_object('schemaVersion',1,'commercial',jsonb_build_object('validUntil',(now()-interval '1 day')),'pricingComponents',jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','x','calculationMethod','FIXED_AMOUNT','numericValue','1','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER'))))$$,
  'P0001',
  'invalid_quote_payload',
  'a past validity is rejected'
);
SELECT throws_ok(
  $$SELECT public.normalize_quote_response_v2(jsonb_build_object('schemaVersion',1,'commercial',jsonb_build_object('validUntil',(now()+interval '1 day')),'pricingComponents','[]'::jsonb))$$,
  'P0001',
  'invalid_quote_payload',
  'an empty pricing component list is rejected'
);

-- Create a fresh multi-recipient RFQ for the quotation flow.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p7_rfq AS
SELECT public.create_and_dispatch_quote_request_v2(jsonb_build_object(
  'clientOperationId', '00000000-0000-0000-0000-00000000e700'::uuid,
  'transactionType', 'SELL_DORE',
  'recipientIds', jsonb_build_array(
    (SELECT user_id FROM _p4_users WHERE slot = 'bob')::text,
    (SELECT user_id FROM _p4_users WHERE slot = 'carol')::text
  ),
  'terms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),
    'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','3','quantityUnit','KG'),
    'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
    'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
  )
)) AS result;

CREATE TEMP TABLE _p7_request AS
SELECT (result->>'quoteRequestId')::uuid AS request_id FROM _p7_rfq;

CREATE TEMP TABLE _p7_bob_inv AS
SELECT i.id FROM public.quote_request_invitations i
WHERE i.request_id = (SELECT request_id FROM _p7_request)
  AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'bob');
CREATE TEMP TABLE _p7_carol_inv AS
SELECT i.id FROM public.quote_request_invitations i
WHERE i.request_id = (SELECT request_id FROM _p7_request)
  AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'carol');

-- bob submits a V2 quotation.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
CREATE TEMP TABLE _p7_bob_response AS
SELECT public.submit_quote_response_v2(jsonb_build_object(
  'invitationId', (SELECT id FROM _p7_bob_inv),
  'clientResponseId', '00000000-0000-0000-0000-00000000e701'::uuid,
  'responseTerms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('validUntil', (now() + interval '1 day')),
    'material', '{}'::jsonb, 'assay', '{}'::jsonb, 'logistics', '{}'::jsonb,
    'pricingComponents', jsonb_build_array(
      jsonb_build_object('componentType','PREMIUM','label','Refining premium','calculationMethod','FIXED_AMOUNT','numericValue','1.25','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER'),
      jsonb_build_object('componentType','ASSAY_FEE','label','Assay fee','calculationMethod','FIXED_AMOUNT','numericValue','0.10','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER')
    )
  )
)) AS result;

SELECT is(
  (SELECT result->'response'->>'status' FROM _p7_bob_response),
  'submitted',
  'bob submits a V2 quotation'
);
SELECT is(
  (SELECT count(*) FROM public.quote_pricing_components WHERE response_id = (SELECT (result->'response'->>'id')::uuid FROM _p7_bob_response)),
  2::bigint,
  'two pricing components are persisted'
);
SELECT ok(
  (SELECT responder_organization_id FROM public.quote_responses WHERE id = (SELECT (result->'response'->>'id')::uuid FROM _p7_bob_response)) = (SELECT org_id FROM _p4_orgs WHERE slot = 'b'),
  'responder organization is snapshotted from the membership'
);
SELECT is(
  (SELECT status FROM public.quote_request_invitations WHERE id = (SELECT id FROM _p7_bob_inv)),
  'responded',
  'invitation status becomes responded'
);

-- requester counters (append-only child, parent superseded).
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p7_counter AS
SELECT public.counter_quote_response_v2(jsonb_build_object(
  'parentResponseId', (SELECT (result->'response'->>'id')::uuid FROM _p7_bob_response),
  'clientResponseId', '00000000-0000-0000-0000-00000000e702'::uuid,
  'responseTerms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('validUntil', (now() + interval '1 day')),
    'material', '{}'::jsonb, 'assay', '{}'::jsonb, 'logistics', '{}'::jsonb,
    'pricingComponents', jsonb_build_array(
      jsonb_build_object('componentType','PREMIUM','label','Counter premium','calculationMethod','FIXED_AMOUNT','numericValue','0.90','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER')
    )
  )
)) AS result;

SELECT is(
  (SELECT result->'response'->>'status' FROM _p7_counter),
  'countered',
  'the owner can counter a quotation'
);
SELECT is(
  (SELECT status FROM public.quote_responses WHERE id = (SELECT (result->'response'->>'id')::uuid FROM _p7_bob_response)),
  'superseded',
  'the parent response is logically superseded'
);
SELECT ok(
  (SELECT parent_response_id FROM public.quote_responses WHERE id = (SELECT (result->'response'->>'id')::uuid FROM _p7_counter)) = (SELECT (result->'response'->>'id')::uuid FROM _p7_bob_response),
  'the counter references its parent response'
);

-- P7-037: cross-invitation counter is rejected.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'carol'))::text, true);
SELECT throws_ok(
  $$SELECT public.counter_quote_response_v2(jsonb_build_object(
    'parentResponseId', (SELECT (result->'response'->>'id')::uuid FROM _p7_counter),
    'clientResponseId', gen_random_uuid(),
    'responseTerms', jsonb_build_object(
      'schemaVersion', 1,
      'commercial', jsonb_build_object('validUntil', (now() + interval '1 day')),
      'material', '{}'::jsonb, 'assay', '{}'::jsonb, 'logistics', '{}'::jsonb,
      'pricingComponents', jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','x','calculationMethod','FIXED_AMOUNT','numericValue','1','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER'))
    )
  ))$$,
  'P0001',
  'not_authorized',
  'a sibling recipient cannot counter another recipient response'
);

-- Immutability: submitted responses and components cannot be edited.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
SELECT throws_ok(
  $$UPDATE public.quote_responses SET response_terms = '{}'::jsonb WHERE id = (SELECT (result->'response'->>'id')::uuid FROM _p7_bob_response)$$,
  'P0001',
  'quote_response_immutable',
  'a submitted response cannot be mutated'
);
SELECT throws_ok(
  $$UPDATE public.quote_pricing_components SET label = 'x' WHERE response_id = (SELECT (result->'response'->>'id')::uuid FROM _p7_bob_response)$$,
  'P0001',
  'pricing_component_immutable',
  'pricing components cannot be mutated'
);

-- Withdraw only the responder's own latest response.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT is(
  public.withdraw_quote_response((SELECT (result->'response'->>'id')::uuid FROM _p7_counter))->>'ok',
  'true',
  'the responder can withdraw their latest response'
);
SELECT is(
  (SELECT status FROM public.quote_responses WHERE id = (SELECT (result->'response'->>'id')::uuid FROM _p7_counter)),
  'withdrawn',
  'the withdrawn response is marked withdrawn'
);

-- Decline an invitation.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'carol'))::text, true);
SELECT is(
  public.decline_quote_invitation((SELECT id FROM _p7_carol_inv))->>'ok',
  'true',
  'a recipient can decline their invitation'
);
SELECT is(
  (SELECT status FROM public.quote_request_invitations WHERE id = (SELECT id FROM _p7_carol_inv)),
  'declined',
  'the declined invitation is marked declined'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P8: Book Deal V2 and immutable trade snapshot
-- ============================================

SELECT has_table('public', 'deal_events', 'deal_events table exists');
SELECT has_function('public', 'build_deal_snapshot', ARRAY['public.quote_requests','public.quote_responses','uuid','uuid'], 'build_deal_snapshot(...) exists');
SELECT has_function('public', 'book_quote_response_v2', ARRAY['jsonb'], 'book_quote_response_v2(jsonb) exists');
SELECT has_function('public', 'get_deal_projection', ARRAY['uuid'], 'get_deal_projection(uuid) exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.deal_events'::regclass),
  'deal_events has RLS enabled'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.deal_events (deal_id, actor_user_id, event_type) VALUES ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'x')$$,
  '42501',
  NULL,
  'authenticated cannot INSERT deal_events'
);
RESET ROLE;

-- Fresh multi-recipient RFQ; bob and carol both quote.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p8_rfq AS
SELECT public.create_and_dispatch_quote_request_v2(jsonb_build_object(
  'clientOperationId', '00000000-0000-0000-0000-00000000e800'::uuid,
  'transactionType', 'SELL_DORE',
  'recipientIds', jsonb_build_array(
    (SELECT user_id FROM _p4_users WHERE slot = 'bob')::text,
    (SELECT user_id FROM _p4_users WHERE slot = 'carol')::text
  ),
  'terms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('transactionType','SELL_DORE','responseDeadline',(now()+interval '1 day'),'partialFulfilmentAllowed',false),
    'material', jsonb_build_object('primaryMetal','AU','materialForm','DORE','productName','Gold','quantity','3','quantityUnit','KG'),
    'assay', jsonb_build_object('assayStatus','PROVISIONAL'),
    'logistics', jsonb_build_object('currentLocation', jsonb_build_object('countryCode','CH','locality','Zurich'), 'availabilityFrom', now())
  )
)) AS result;

CREATE TEMP TABLE _p8_request AS SELECT (result->>'quoteRequestId')::uuid AS request_id FROM _p8_rfq;
CREATE TEMP TABLE _p8_bob_inv AS
SELECT i.id FROM public.quote_request_invitations i
WHERE i.request_id = (SELECT request_id FROM _p8_request) AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'bob');
CREATE TEMP TABLE _p8_carol_inv AS
SELECT i.id FROM public.quote_request_invitations i
WHERE i.request_id = (SELECT request_id FROM _p8_request) AND i.recipient_user_id = (SELECT user_id FROM _p4_users WHERE slot = 'carol');

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
CREATE TEMP TABLE _p8_bob_resp AS
SELECT public.submit_quote_response_v2(jsonb_build_object(
  'invitationId', (SELECT id FROM _p8_bob_inv),
  'clientResponseId', '00000000-0000-0000-0000-00000000e801'::uuid,
  'responseTerms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('validUntil', (now() + interval '1 day')),
    'material', '{}'::jsonb, 'assay', '{}'::jsonb, 'logistics', '{}'::jsonb,
    'pricingComponents', jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','Premium','calculationMethod','FIXED_AMOUNT','numericValue','1.25','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER'))
  )
)) AS result;

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'carol'))::text, true);
CREATE TEMP TABLE _p8_carol_resp AS
SELECT public.submit_quote_response_v2(jsonb_build_object(
  'invitationId', (SELECT id FROM _p8_carol_inv),
  'clientResponseId', '00000000-0000-0000-0000-00000000e802'::uuid,
  'responseTerms', jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('validUntil', (now() + interval '1 day')),
    'material', '{}'::jsonb, 'assay', '{}'::jsonb, 'logistics', '{}'::jsonb,
    'pricingComponents', jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','Premium','calculationMethod','FIXED_AMOUNT','numericValue','0.80','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER'))
  )
)) AS result;

-- Requester books bob's quotation.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p8_deal AS
SELECT public.book_quote_response_v2(jsonb_build_object(
  'responseId', (SELECT (result->'response'->>'id')::uuid FROM _p8_bob_resp),
  'clientActionId', '00000000-0000-0000-0000-00000000e803'::uuid
)) AS result;

SELECT is(
  (SELECT result->'deal'->>'status' FROM _p8_deal),
  'booked',
  'booking a quotation produces a booked deal'
);
SELECT ok(
  (SELECT (result->'deal'->>'dealReference') FROM _p8_deal) LIKE 'DEAL-%',
  'the deal carries a non-guessable reference'
);
SELECT is(
  (SELECT status FROM public.quote_requests WHERE id = (SELECT request_id FROM _p8_request)),
  'awarded',
  'the RFQ is marked awarded'
);
SELECT is(
  (SELECT status FROM public.quote_request_invitations WHERE id = (SELECT id FROM _p8_carol_inv)),
  'closed',
  'the losing recipient invitation is closed'
);
SELECT ok(
  (SELECT (commercial_terms_snapshot->'pricingComponents') IS NOT NULL
   FROM public.trade_deals WHERE id = (SELECT (result->'deal'->>'id')::uuid FROM _p8_deal)),
  'the deal snapshot contains the pricing components'
);
SELECT ok(
  (SELECT (commercial_terms_snapshot->>'requesterOrganizationId') = (SELECT org_id::text FROM _p4_orgs WHERE slot = 'a')
   FROM public.trade_deals WHERE id = (SELECT (result->'deal'->>'id')::uuid FROM _p8_deal)),
  'the deal snapshot captures the requester organization'
);

-- Single award: a second book is rejected.
SELECT throws_ok(
  $$SELECT public.book_quote_response_v2(jsonb_build_object('responseId', (SELECT (result->'response'->>'id')::uuid FROM _p8_carol_resp), 'clientActionId', gen_random_uuid()))$$,
  'P0001',
  'deal_already_booked',
  'a second booking is rejected (single award)'
);

-- Deal parties can read the projection; third parties cannot.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'carol'))::text, true);
SELECT throws_ok(
  $$SELECT public.get_deal_projection((SELECT (result->'deal'->>'id')::uuid FROM _p8_deal))$$,
  'P0001',
  'not_authorized',
  'a losing recipient cannot read the deal'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
SELECT ok(
  (SELECT public.get_deal_projection((SELECT (result->'deal'->>'id')::uuid FROM _p8_deal))->>'dealReference') LIKE 'DEAL-%',
  'the winning counterparty can read the deal'
);

-- Idempotency: replay with the same payload returns the same deal.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
CREATE TEMP TABLE _p8_replay AS
SELECT public.book_quote_response_v2(jsonb_build_object(
  'responseId', (SELECT (result->'response'->>'id')::uuid FROM _p8_bob_resp),
  'clientActionId', '00000000-0000-0000-0000-00000000e803'::uuid
)) AS result;
SELECT is(
  (SELECT (result->'deal'->>'id')::uuid FROM _p8_replay),
  (SELECT (result->'deal'->>'id')::uuid FROM _p8_deal),
  'an idempotent replay returns the same deal'
);
SELECT throws_ok(
  $$SELECT public.book_quote_response_v2(jsonb_build_object('responseId', (SELECT (result->'response'->>'id')::uuid FROM _p8_bob_resp), 'clientActionId', gen_random_uuid()))$$,
  'P0001',
  'deal_already_booked',
  'booking an already-booked response is rejected'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P9: Compliance and inventory integration
-- ============================================

SELECT has_table('public', 'compliance_snapshots', 'compliance_snapshots table exists');
SELECT has_table('public', 'inventory_lots', 'inventory_lots table exists');
SELECT has_table('public', 'inventory_sync_runs', 'inventory_sync_runs table exists');
SELECT has_function('public', 'get_counterparty_summary', ARRAY['uuid'], 'get_counterparty_summary(uuid) exists');
SELECT has_function('public', 'list_inventory_projection', ARRAY[]::text[], 'list_inventory_projection() exists');

SELECT ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.compliance_snapshots'::regclass, 'public.inventory_lots'::regclass, 'public.inventory_sync_runs'::regclass)),
  'integration tables have RLS enabled'
);

-- No snapshot: explicit unavailable, never approved.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT is(
  public.get_counterparty_summary((SELECT org_id FROM _p4_orgs WHERE slot = 'b'))->>'status',
  'unavailable',
  'a missing compliance snapshot reports unavailable, not approved'
);
SELECT is(
  jsonb_array_length(public.list_inventory_projection()),
  0,
  'an organization with no lots sees an empty inventory'
);

-- Seed a lot and a blocked snapshot for org A.
INSERT INTO public.inventory_lots (organization_id, source_system, external_reference, primary_metal, material_form, quantity, quantity_unit, availability_status)
VALUES ((SELECT org_id FROM _p4_orgs WHERE slot = 'a'), 'mock', 'LOT-AU-001', 'AU', 'BAR', 12.5, 'KG', 'available');

INSERT INTO public.compliance_snapshots (subject_organization_id, viewer_organization_id, provider, kyc_status, kys_status, trading_eligibility, reason_codes)
VALUES ((SELECT org_id FROM _p4_orgs WHERE slot = 'b'), (SELECT org_id FROM _p4_orgs WHERE slot = 'a'), 'mock', 'blocked', 'blocked', false, '["blocked"]'::jsonb);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT is(
  jsonb_array_length(public.list_inventory_projection()),
  1,
  'the requester sees their own organization lots'
);
SELECT is(
  public.get_counterparty_summary((SELECT org_id FROM _p4_orgs WHERE slot = 'b'))->>'status',
  'blocked',
  'a stored blocked snapshot is returned'
);

-- Cross-organization inventory isolation.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'carol'))::text, true);
SELECT is(
  jsonb_array_length(public.list_inventory_projection()),
  0,
  'another organization cannot see org A inventory'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P10: Document storage and access grants
-- ============================================

SELECT has_table('public', 'documents', 'documents table exists');
SELECT has_table('public', 'document_versions', 'document_versions table exists');
SELECT has_table('public', 'document_tags', 'document_tags table exists');
SELECT has_table('public', 'document_access_grants', 'document_access_grants table exists');
SELECT has_table('public', 'document_generation_jobs', 'document_generation_jobs table exists');
SELECT has_table('public', 'document_events', 'document_events table exists');
SELECT has_function('public', 'get_document_projection', ARRAY['uuid'], 'get_document_projection(uuid) exists');
SELECT has_function('public', 'acknowledge_document', ARRAY['uuid'], 'acknowledge_document(uuid) exists');
SELECT has_function('public', 'has_document_grant', ARRAY['uuid','text'], 'has_document_grant(uuid,text) exists');

SELECT ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (
    'public.documents'::regclass, 'public.document_versions'::regclass,
    'public.document_tags'::regclass, 'public.document_access_grants'::regclass,
    'public.document_generation_jobs'::regclass, 'public.document_events'::regclass
  )),
  'document tables have RLS enabled'
);

-- Seed a document granted only to org A.
CREATE TEMP TABLE _p10_doc AS
WITH ins AS (
  INSERT INTO public.documents (id, document_type, status, transaction_type)
  VALUES (gen_random_uuid(), 'trade_confirmation', 'generated', 'SELL_DORE')
  RETURNING id
)
SELECT id FROM ins;

INSERT INTO public.document_access_grants (document_id, grantee_type, grantee_id, rights)
VALUES ((SELECT id FROM _p10_doc), 'organization', (SELECT org_id FROM _p4_orgs WHERE slot = 'a'), '["view"]'::jsonb);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT ok(
  (public.get_document_projection((SELECT id FROM _p10_doc))->>'documentType') = 'trade_confirmation',
  'a granted viewer can read the document projection'
);
SELECT is(
  public.acknowledge_document((SELECT id FROM _p10_doc))->>'ok',
  'true',
  'a granted viewer can acknowledge the document'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'bob'))::text, true);
SELECT throws_ok(
  $$SELECT public.get_document_projection((SELECT id FROM _p10_doc))$$,
  'P0001',
  'not_authorized',
  'a non-granted viewer cannot read the document'
);
SELECT throws_ok(
  $$SELECT public.acknowledge_document((SELECT id FROM _p10_doc))$$,
  'P0001',
  'not_authorized',
  'a non-granted viewer cannot acknowledge the document'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P11: Trade volume ledger
-- ============================================

SELECT has_table('public', 'trade_volume_entries', 'trade_volume_entries table exists');
SELECT has_table('public', 'trade_volume_import_batches', 'trade_volume_import_batches table exists');
SELECT has_table('public', 'trade_volume_import_rows', 'trade_volume_import_rows table exists');
SELECT has_function('public', 'list_trade_volume', ARRAY['timestamptz','timestamptz'], 'list_trade_volume(timestamptz,timestamptz) exists');
SELECT has_function('public', 'reconcile_trade_volume', ARRAY[]::text[], 'reconcile_trade_volume() exists');

SELECT ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (
    'public.trade_volume_entries'::regclass, 'public.trade_volume_import_batches'::regclass, 'public.trade_volume_import_rows'::regclass
  )),
  'trade volume tables have RLS enabled'
);

-- The P8 booked deal created idempotent volume entries for both organizations.
SELECT is(
  (SELECT count(*) FROM public.trade_volume_entries
   WHERE deal_id = (SELECT (result->'deal'->>'id')::uuid FROM _p8_deal) AND source_type = 'xchat_deal'),
  2::bigint,
  'booking a deal creates one volume entry per organization'
);
SELECT is(
  (SELECT normalized_grams FROM public.trade_volume_entries
   WHERE deal_id = (SELECT (result->'deal'->>'id')::uuid FROM _p8_deal)
     AND organization_id = (SELECT org_id FROM _p4_orgs WHERE slot = 'a')
   LIMIT 1),
  3000::numeric,
  '3 KG normalizes to 3000 grams'
);

-- Org-scoped aggregation.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT is(
  (SELECT count(*) FROM jsonb_array_elements(public.list_trade_volume(NULL, NULL))),
  1::bigint,
  'the requester sees their own trade volume'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'carol'))::text, true);
SELECT is(
  jsonb_array_length(public.list_trade_volume(NULL, NULL)),
  0,
  'another organization cannot see org A trade volume'
);

-- Reconciliation finds no missing entries after booking.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT is(
  jsonb_array_length(public.reconcile_trade_volume()->'missingDealIds'),
  0,
  'reconciliation finds no deals without a volume entry'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P12: Realtime, outbox and catch-up
-- ============================================

SELECT has_table('public', 'domain_outbox', 'domain_outbox table exists');
SELECT has_function('public', 'list_trading_events_since', ARRAY['timestamptz','integer'], 'list_trading_events_since(timestamptz,integer) exists');
SELECT has_function('public', 'claim_outbox_batch', ARRAY['integer'], 'claim_outbox_batch(integer) exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.domain_outbox'::regclass),
  'domain_outbox has RLS enabled'
);

-- Catch-up projection is user-scoped (no cross-recipient leakage).
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);
SELECT ok(
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.list_trading_events_since('1970-01-01'::timestamptz)) e
    WHERE e->>'kind' = 'deal'
  ),
  'the requester sees their deal events via catch-up'
);

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'carol'))::text, true);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.list_trading_events_since('1970-01-01'::timestamptz)) e
    WHERE e->>'kind' = 'deal'
  ),
  'a losing recipient sees no deal events via catch-up'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P13: Security hardening and abuse tests
-- ============================================

-- Guessed (random) IDs across UUID-bearing RPCs.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);

SELECT throws_ok(
  $$SELECT public.get_quote_request_projection(gen_random_uuid())$$,
  'P0001',
  'not_authorized',
  'a guessed request id is rejected'
);
SELECT throws_ok(
  $$SELECT public.get_quote_invitation_projection(gen_random_uuid())$$,
  'P0001',
  'not_authorized',
  'a guessed invitation id is rejected'
);
SELECT throws_ok(
  $$SELECT public.get_deal_projection(gen_random_uuid())$$,
  'P0001',
  'deal_not_found',
  'a guessed deal id is rejected'
);
SELECT throws_ok(
  $$SELECT public.get_document_projection(gen_random_uuid())$$,
  'P0001',
  'not_authorized',
  'a guessed document id is rejected'
);
SELECT throws_ok(
  $$SELECT public.book_quote_response_v2(jsonb_build_object('responseId', gen_random_uuid(), 'clientActionId', gen_random_uuid()))$$,
  'P0001',
  'response_not_found',
  'a guessed response id is rejected on book'
);

-- Tampered pricing components: numeric overflow and malformed numbers.
SELECT throws_ok(
  $$SELECT public.normalize_quote_response_v2(jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('validUntil', (now() + interval '1 day')),
    'pricingComponents', jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','x','calculationMethod','FIXED_AMOUNT','numericValue', repeat('9', 50), 'currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER'))
  ))$$,
  'P0001',
  'invalid_quote_payload',
  'a numeric overflow in a pricing component is rejected'
);
SELECT throws_ok(
  $$SELECT public.normalize_quote_response_v2(jsonb_build_object(
    'schemaVersion', 1,
    'commercial', jsonb_build_object('validUntil', (now() + interval '1 day')),
    'pricingComponents', jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','x','calculationMethod','FIXED_AMOUNT','numericValue','not-a-number','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER'))
  ))$$,
  'P0001',
  'invalid_quote_payload',
  'a malformed numeric value is rejected'
);

SELECT set_config('request.jwt.claims', '', true);

-- ============================================
-- P14: Observability and reconciliation
-- ============================================

SELECT has_function('public', 'health_check', ARRAY[]::text[], 'health_check() exists');
SELECT has_function('public', 'reconcile_rfq_status', ARRAY[]::text[], 'reconcile_rfq_status() exists');
SELECT has_function('public', 'reconcile_deal_decision', ARRAY[]::text[], 'reconcile_deal_decision() exists');
SELECT has_function('public', 'reconcile_document_metadata', ARRAY[]::text[], 'reconcile_document_metadata() exists');

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'requester'))::text, true);

SELECT ok(
  (public.health_check()->>'database')::boolean,
  'health check reports a healthy database'
);
SELECT ok(
  (public.reconcile_rfq_status()->'inconsistentRfqIds') ? '00000000-0000-0000-0000-00000000d201',
  'reconciliation finds the open RFQ with a booked deal'
);
SELECT ok(
  (public.reconcile_deal_decision()->'dealsWithoutDecision') ? '00000000-0000-0000-0000-00000000d501',
  'reconciliation finds the deal without an accepted decision'
);
SELECT ok(
  jsonb_array_length(public.reconcile_document_metadata()->'documentsWithoutVersion') >= 1,
  'reconciliation finds the generated document without a version'
);

SELECT set_config('request.jwt.claims', '', true);

SELECT * FROM finish();

ROLLBACK;
