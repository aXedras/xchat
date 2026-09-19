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

-- ============================================
-- Phase 2: organizations, memberships and roles
-- ============================================
-- Additional security-test users (Alex: Mine A / Viewer; Eve: Dealer D /
-- unauthorized). The on_auth_user_created trigger creates their profiles.
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
    '10000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated',
    'alex@xchat.test.local',
    crypt('Al3x-Test-Pw', gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Alex Viewer","email_verified":true}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated',
    'eve@xchat.test.local',
    crypt('Ev3-Test-Pw', gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Eve Dealer","email_verified":true}'::jsonb,
    now(), now()
  );

-- Seed organizations (fixed ids for deterministic e2e).
INSERT INTO public.organizations (id, legal_name, display_name, jurisdiction_country_code, status, source_system)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Mine A AG', 'Mine A', 'CH', 'active', 'xchat'),
  ('20000000-0000-0000-0000-000000000002', 'Refinery B SA', 'Refinery B', 'CH', 'active', 'xchat'),
  ('20000000-0000-0000-0000-000000000003', 'Refinery C SA', 'Refinery C', 'CH', 'active', 'xchat'),
  ('20000000-0000-0000-0000-000000000004', 'Dealer D LLC', 'Dealer D', 'US', 'active', 'xchat'),
  ('20000000-0000-0000-0000-000000000005', 'xChat Platform Operations', 'xChat Platform', 'CH', 'active', 'xchat');

-- Organization capabilities (one active per organization in the seed).
INSERT INTO public.organization_capabilities (organization_id, capability_code, status, valid_from)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'MINE_OPERATOR', 'active', now()),
  ('20000000-0000-0000-0000-000000000002', 'REFINER', 'active', now()),
  ('20000000-0000-0000-0000-000000000002', 'TRADER', 'active', now()),
  ('20000000-0000-0000-0000-000000000003', 'REFINER', 'active', now()),
  ('20000000-0000-0000-0000-000000000004', 'DEALER', 'active', now()),
  ('20000000-0000-0000-0000-000000000005', 'OTHER', 'active', now());

-- Active memberships (exactly one active membership per user).
INSERT INTO public.organization_memberships (user_id, organization_id, job_title, status, valid_from)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Trader', 'active', now()),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Viewer', 'active', now()),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Sales', 'active', now()),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Trader', 'active', now()),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000004', NULL, 'active', now()),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005', 'Platform Admin', 'active', now());

-- Organization-scoped platform roles. Eve intentionally has no role
-- (unauthorized identity for security tests).
INSERT INTO public.user_platform_roles (user_id, role_code, organization_id, valid_from)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'TRADER', '20000000-0000-0000-0000-000000000001', now()),
  ('10000000-0000-0000-0000-000000000005', 'VIEWER', '20000000-0000-0000-0000-000000000001', now()),
  ('10000000-0000-0000-0000-000000000002', 'SALES', '20000000-0000-0000-0000-000000000002', now()),
  ('10000000-0000-0000-0000-000000000003', 'TRADER', '20000000-0000-0000-0000-000000000003', now()),
  ('10000000-0000-0000-0000-000000000004', 'PLATFORM_ADMIN', NULL, now());

-- Keep the legacy free-text profile.organization in sync during the transition
-- so the legacy participant directory (flag off) stays informative. The field
-- itself is not removed (Phase 2 step P2-040).
UPDATE public.profile SET organization = 'Mine A' WHERE user_id = '10000000-0000-0000-0000-000000000001';
UPDATE public.profile SET organization = 'Mine A' WHERE user_id = '10000000-0000-0000-0000-000000000005';
UPDATE public.profile SET organization = 'Refinery B' WHERE user_id = '10000000-0000-0000-0000-000000000002';
UPDATE public.profile SET organization = 'Refinery C' WHERE user_id = '10000000-0000-0000-0000-000000000003';
UPDATE public.profile SET organization = 'Dealer D' WHERE user_id = '10000000-0000-0000-0000-000000000006';
UPDATE public.profile SET organization = 'xChat Platform' WHERE user_id = '10000000-0000-0000-0000-000000000004';

-- Enable the transaction RFQ V2 flow for local development and e2e. Production
-- keeps flags off via the migration default (feature_flags seeded disabled).
UPDATE public.feature_flags SET enabled = true WHERE key = 'transactionRfqV2';
UPDATE public.feature_flags SET enabled = true WHERE key = 'tradingOrganizationsV2';
