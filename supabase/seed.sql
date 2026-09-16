-- Seed the closed-group messaging demo users so that local development and the
-- e2e suite work after every `supabase db reset`.
--
-- Passwords are bcrypt-hashed with pgcrypto; GoTrue verifies them on login.
-- The `on_auth_user_created` trigger creates the matching public.profile rows.
-- All token/change columns mirror what GoTrue writes itself so its SELECT scan
-- does not fail on NULL values.

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'alice@xchat.test.local',
    crypt('Al1ce-Test-Pw', gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Alice Metal","email_verified":true}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated',
    'bob@xchat.test.local',
    crypt('B0b-Test-Pw', gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Bob Trader","email_verified":true}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated',
    'carol@xchat.test.local',
    crypt('Car0l-Test-Pw', gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Carol Ops","email_verified":true}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated',
    'admin@xchat.test.local',
    crypt('Adm1n-Test-Pw', gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Metal","email_verified":true}'::jsonb,
    now(), now()
  );

-- The admin user carries the canonical 'vendor' role so the Admin Console is
-- reachable in local development and the e2e admin specs.
INSERT INTO public.user_roles ("user_id", "role")
VALUES ('10000000-0000-0000-0000-000000000004', 'vendor');
