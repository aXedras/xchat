-- ============================================
-- Migration: Add is_default flag to elements table
-- Date: 2025-10-16
-- Purpose: Enable marking elements as default for XRF analysis validation
-- ============================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- ============================================
-- Create index for better query performance
-- ============================================

-- Index for supply_id (now integer - simple B-tree index)
CREATE INDEX IF NOT EXISTS idx_supply_supply_id 
ON public.supply(external_supply_id);
-- Index for Scan Date sorting and range filtering
CREATE INDEX IF NOT EXISTS idx_supply_scan_date 
ON public.supply(scan_date DESC NULLS LAST);
-- Index for Declared Origin filtering
CREATE INDEX IF NOT EXISTS idx_supply_declared_origin 
ON public.supply(declared_origin_id);
-- Index for Predicted Origin filtering
CREATE INDEX IF NOT EXISTS idx_supply_predicted_origin 
ON public.supply(predicted_origin_id);
-- Composite index for common filter combinations
-- (declared_origin + date range + supply_id)
CREATE INDEX IF NOT EXISTS idx_supply_filters_composite 
ON public.supply(declared_origin_id, scan_date DESC, external_supply_id);
-- Index for supply_elements to speed up JOINs
CREATE INDEX IF NOT EXISTS idx_supply_elements_supply_id 
ON public.supply_elements(supply_id);
CREATE INDEX IF NOT EXISTS idx_supply_elements_element_id 
ON public.supply_elements(element_id);
CREATE INDEX IF NOT EXISTS idx_supply_elements_status_id 
ON public.supply_elements(status_id);
CREATE INDEX IF NOT EXISTS idx_supply_elements_unit_id 
ON public.supply_elements(unit_id);
-- Index for measurement_status active lookup
CREATE INDEX IF NOT EXISTS idx_measurement_status_active 
ON public.measurement_status(is_active) 
WHERE is_active = true;
-- Index for measurement_units active lookup
CREATE INDEX IF NOT EXISTS idx_measurement_units_active 
ON public.measurement_units(is_active) 
WHERE is_active = true;
-- Index for origins name lookups
CREATE INDEX IF NOT EXISTS idx_origins_name 
ON public.origins(name);
-- Unique Constraint: Only ONE active model at a time
-- Uses partial unique index for better performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_single_active 
  ON public.models(is_active) 
  WHERE is_active = true;
-- Query by status (frequent operation)
CREATE INDEX IF NOT EXISTS idx_models_status 
  ON public.models(status);
-- Query by training timestamp (for sorting, recent models)
CREATE INDEX IF NOT EXISTS idx_models_training_timestamp 
  ON public.models(training_timestamp DESC);
-- Query by name and version (lookup specific model versions)
CREATE INDEX IF NOT EXISTS idx_models_name_version 
  ON public.models(model_name, model_version);
-- Query active models (very frequent)
CREATE INDEX IF NOT EXISTS idx_models_active 
  ON public.models(is_active) 
  WHERE is_active = true;
-- Query by tags (filtering, search)
CREATE INDEX IF NOT EXISTS idx_models_tags 
  ON public.models USING GIN (tags);
-- Query by accuracy (finding best models)
CREATE INDEX IF NOT EXISTS idx_models_accuracy 
  ON public.models(training_accuracy DESC);
-- Full-text search on model names and descriptions
CREATE INDEX IF NOT EXISTS idx_models_search 
  ON public.models USING GIN (
    to_tsvector('english', COALESCE(model_name, '') || ' ' || COALESCE(description, ''))
  );
-- ============================================
-- Performance Optimization for Supply Analytics
-- ============================================

-- Index on supply.declared_origin_id (JOIN with customer_origins)
-- This is the most critical index for filtering by customer
CREATE INDEX IF NOT EXISTS idx_supply_declared_origin_id 
ON supply(declared_origin_id);
-- Composite index for supply_elements aggregation queries
-- Covers supply_id + element_id + concentration for faster GROUP BY
CREATE INDEX IF NOT EXISTS idx_supply_elements_aggregation 
ON supply_elements(supply_id, element_id, concentration);
-- Index on customer_origins for customer lookup
CREATE INDEX IF NOT EXISTS idx_customer_origins_customer_id 
ON customer_origins(customer_id);
-- Index on customer_origins.origin_id (JOIN with supply)
CREATE INDEX IF NOT EXISTS idx_customer_origins_origin_id 
ON customer_origins(origin_id);
-- Composite index for the full join path used in analytics
-- Optimizes: customer_origins.customer_id + origin_id together
CREATE INDEX IF NOT EXISTS idx_customer_origins_customer_origin 
ON customer_origins(customer_id, origin_id);
COMMENT ON INDEX idx_supply_declared_origin_id IS 
  'Speeds up supply filtering by declared_origin_id in analytics queries';
COMMENT ON INDEX idx_supply_elements_supply_id IS 
  'Speeds up JOIN from supply to supply_elements';
COMMENT ON INDEX idx_supply_elements_element_id IS 
  'Speeds up JOIN from supply_elements to elements';
COMMENT ON INDEX idx_supply_elements_aggregation IS 
  'Composite index for aggregation queries (GROUP BY element, aggregate concentration)';
COMMENT ON INDEX idx_customer_origins_customer_id IS 
  'Speeds up customer filtering in customer_origins';
COMMENT ON INDEX idx_customer_origins_origin_id IS 
  'Speeds up JOIN from customer_origins to supply via declared_origin_id';
COMMENT ON INDEX idx_customer_origins_customer_origin IS 
  'Composite index for customer + origin lookup, optimizes the complete join path';
-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS "models_status_idx" ON public.models ("status");
CREATE INDEX IF NOT EXISTS "models_is_active_idx" ON public.models ("is_active");
CREATE INDEX IF NOT EXISTS "models_training_timestamp_idx" ON public.models ("training_timestamp" DESC);
CREATE INDEX IF NOT EXISTS "models_training_accuracy_idx" ON public.models ("training_accuracy" DESC);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_prediction_results_supply_id" 
  ON public.prediction_results ("supply_id");
CREATE INDEX IF NOT EXISTS "idx_prediction_results_rank" 
  ON public.prediction_results ("supply_id", "rank");
-- RBAC Index for fast category lookups
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);
-- Index for fast role → permissions lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);
-- Index for origin_id_mapping lookups
CREATE INDEX IF NOT EXISTS idx_origin_id_mapping_declared_origin ON public.origin_id_mapping(declared_origin_code);
CREATE INDEX IF NOT EXISTS idx_origin_id_mapping_external_id ON public.origin_id_mapping(external_id);
CREATE INDEX IF NOT EXISTS idx_origin_id_mapping_batch ON public.origin_id_mapping(batch);
-- Add unique partial index to ensure only one category can be default
-- Partial index only indexes rows where is_default = TRUE
CREATE UNIQUE INDEX idx_element_categories_single_default 
ON element_categories (is_default) 
WHERE is_default = TRUE;
COMMENT ON INDEX idx_element_categories_single_default IS 'Ensures only one element category can be marked as default';
-- Index for fetching recent jobs
CREATE INDEX IF NOT EXISTS idx_auto_prediction_jobs_created_at 
  ON public.auto_prediction_jobs(created_at DESC);
-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_auto_prediction_jobs_status 
  ON public.auto_prediction_jobs(status);

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
