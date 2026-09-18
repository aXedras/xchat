-- Create custom types
CREATE TYPE public.app_role AS ENUM (
    'vendor',
    'manager',
    'operator'
);
COMMENT ON TYPE public.app_role IS 'Application roles: vendor (god mode), manager (limited), operator (minimal), legacy roles: admin, user, viewer';
ALTER TYPE public.app_role OWNER TO postgres;

-- Essential extension used by the seed (bcrypt password hashing) and by the
-- admin user-management RPCs.
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
-- ============================================
-- USER TABLES
-- ============================================

-- Create profile table for user data
CREATE TABLE IF NOT EXISTS public.profile (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null unique,
  "full_name" text,
  "organization" text,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now()
);
ALTER TABLE public.profile OWNER TO postgres;
-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "role" public.app_role not null,
  "created_at" timestamptz default now(),
  UNIQUE ("user_id")
);
ALTER TABLE public.user_roles OWNER TO postgres;
-- ============================================
-- SYSTEM SETTINGS TABLES
-- ============================================

-- Create system_settings table (key-value configuration store)
CREATE TABLE IF NOT EXISTS public.system_settings (
  "id" uuid default gen_random_uuid() not null,
  "key" text not null unique,
  "value" text not null,
  "value_type" text not null check ("value_type" IN ('string', 'number', 'boolean', 'json')),
  "category" text not null check ("category" IN ('system', 'email', 'backup', 'security')),
  "description" text,
  "allowed_values" jsonb,
  "is_sensitive" boolean default false,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now()
);
ALTER TABLE public.system_settings OWNER TO postgres;
-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS "idx_system_settings_key" ON public.system_settings USING btree ("key");
CREATE INDEX IF NOT EXISTS "idx_system_settings_category" ON public.system_settings USING btree ("category");
-- ============================================
-- PRIMARY KEYS
-- ============================================
ALTER TABLE ONLY public.profile ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.system_settings ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");
-- ============================================
-- FOREIGN KEYS
-- ============================================

-- User-related foreign keys
ALTER TABLE ONLY public.profile 
  ADD CONSTRAINT "profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles 
  ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
-- Add comments for documentation
COMMENT ON TABLE public.system_settings IS 'System-wide configuration settings for the application';
COMMENT ON COLUMN public.system_settings.key IS 'Unique setting identifier in dot notation';
COMMENT ON COLUMN public.system_settings.category IS 'Setting category for grouping';

-- ============================================
-- xChat Closed-Group Messaging Tables (user-id based)
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_low_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  participant_high_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CONSTRAINT conversations_pair_unique UNIQUE (participant_low_user_id, participant_high_user_id),
  CONSTRAINT conversations_pair_ordered CHECK (participant_low_user_id < participant_high_user_id)
);
ALTER TABLE public.conversations OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE RESTRICT,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('standard', 'rfq')),
  content text NOT NULL,
  quote_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_distinct_participants CHECK (sender_user_id <> recipient_user_id)
);
ALTER TABLE public.messages OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.message_dispatch (
  id uuid PRIMARY KEY,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  message_type text NOT NULL CHECK (message_type IN ('standard', 'rfq')),
  content text NOT NULL,
  quote_request_id uuid,
  status text NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_dispatch OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.message_dispatch_recipient (
  dispatch_id uuid NOT NULL REFERENCES public.message_dispatch(id) ON DELETE RESTRICT,
  requested_recipient_user_id uuid NOT NULL,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('accepted', 'rejected')),
  error_code text CHECK (error_code IN ('recipient_not_found', 'self_recipient')),
  message_id uuid REFERENCES public.messages(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dispatch_id, requested_recipient_user_id),
  CONSTRAINT dispatch_recipient_shape CHECK (
    (status = 'accepted' AND recipient_user_id IS NOT NULL AND message_id IS NOT NULL AND error_code IS NULL)
    OR
    (status = 'rejected' AND error_code IS NOT NULL AND recipient_user_id IS NULL AND message_id IS NULL)
  )
);
ALTER TABLE public.message_dispatch_recipient OWNER TO postgres;

-- ============================================
-- xChat RFQ Aggregate Tables (M8)
-- ============================================

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  terms jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converted')),
  response_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_requests OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.quote_request_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_request_invitations_unique UNIQUE (request_id, recipient_user_id)
);
ALTER TABLE public.quote_request_invitations OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.quote_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES public.quote_request_invitations(id) ON DELETE RESTRICT,
  responder_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  parent_response_id uuid REFERENCES public.quote_responses(id) ON DELETE RESTRICT,
  client_response_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('submitted', 'countered')),
  quoted_premium text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_responses_client_id_unique UNIQUE (responder_user_id, client_response_id),
  CONSTRAINT quote_responses_parent_not_self CHECK (parent_response_id IS NULL OR parent_response_id <> id)
);
ALTER TABLE public.quote_responses OWNER TO postgres;

-- Append-only terminal decisions. A response is never mutated after insert;
-- reject/accept are recorded here instead.
CREATE TABLE IF NOT EXISTS public.quote_response_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid NOT NULL UNIQUE REFERENCES public.quote_responses(id) ON DELETE RESTRICT,
  decided_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  client_action_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_response_decisions_action_unique UNIQUE (decided_by_user_id, client_action_id)
);
ALTER TABLE public.quote_response_decisions OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.trade_deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  response_id uuid NOT NULL REFERENCES public.quote_responses(id) ON DELETE RESTRICT,
  counterparty_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  booked_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  booking_client_action_id uuid NOT NULL,
  product text NOT NULL,
  volume text NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status = 'booked'),
  commercial_terms_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_deals_booking_unique UNIQUE (booked_by_user_id, booking_client_action_id)
);
ALTER TABLE public.trade_deals OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.quote_workflow_idempotency (
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_operation_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('submit', 'counter', 'reject', 'book')),
  canonical_request jsonb NOT NULL,
  result_snapshot jsonb NOT NULL,
  workflow_message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  response_id uuid REFERENCES public.quote_responses(id) ON DELETE RESTRICT,
  deal_id uuid REFERENCES public.trade_deals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_user_id, client_operation_id),
  CONSTRAINT quote_workflow_idempotency_shape CHECK (
    (operation IN ('submit', 'counter', 'reject') AND deal_id IS NULL AND response_id IS NOT NULL)
    OR
    (operation = 'book' AND deal_id IS NOT NULL AND response_id IS NOT NULL)
  )
);
ALTER TABLE public.quote_workflow_idempotency OWNER TO postgres;

ALTER TABLE ONLY public.messages
  ADD CONSTRAINT messages_quote_request_id_fkey FOREIGN KEY (quote_request_id) REFERENCES public.quote_requests(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.message_dispatch
  ADD CONSTRAINT message_dispatch_quote_request_id_fkey FOREIGN KEY (quote_request_id) REFERENCES public.quote_requests(id) ON DELETE RESTRICT;
