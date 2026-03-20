-- Create custom types
CREATE TYPE public.app_role AS ENUM (
    'vendor',
    'manager',
    'operator'
);
COMMENT ON TYPE public.app_role IS 'Application roles: vendor (god mode), manager (limited), operator (minimal), legacy roles: admin, user, viewer';
ALTER TYPE public.app_role OWNER TO postgres;
-- origin status enum type
DROP TYPE IF EXISTS public.origin_status CASCADE;
CREATE TYPE public.origin_status AS ENUM (
    'active',
    'inactive'
);
COMMENT ON TYPE public.origin_status IS 'Status of an origin: active or inactive';
ALTER TYPE public.origin_status OWNER TO postgres;
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
  UNIQUE ("user_id", "role")
);
ALTER TABLE public.user_roles OWNER TO postgres;
-- ============================================
-- SUPPLY CHAIN / XRF TABLES
-- ============================================

-- Create country table (lookup table for country codes)
CREATE TABLE IF NOT EXISTS public.country (
  "id" uuid default gen_random_uuid() not null,
  "code" text not null unique,
  "iso2_code" text not null unique,
  "name" text not null,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.country OWNER TO postgres;
COMMENT ON COLUMN public.country."code" IS 'ISO 3166-1 alpha-3 country code (e.g., PER, USA, DEU)';
COMMENT ON COLUMN public.country."iso2_code" IS 'ISO 3166-1 alpha-2 country code for flag emoji generation (e.g., PE, US, DE)';
-- Create origins table
CREATE TABLE IF NOT EXISTS public.origins (
  "id" uuid default gen_random_uuid() not null,
  "code" text not null unique,
  "name" text,
  "country_id" uuid,
  "status" public.origin_status not null default 'active',
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.origins OWNER TO postgres;
-- Create elements table for periodic system metals/elements
CREATE TABLE IF NOT EXISTS public.elements (
  "id" uuid default gen_random_uuid() not null,
  "symbol" text not null unique,
  "name" text not null,
  "atomic_number" integer not null,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.elements OWNER TO postgres;
-- Create element categories table
CREATE TABLE IF NOT EXISTS public.element_categories (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null unique,
  "is_default" boolean not null default false,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.element_categories OWNER TO postgres;
-- Add comment
COMMENT ON COLUMN public.element_categories."is_default" IS 'Indicates if this category contains default elements for XRF validation and ML prediction';
-- Create element category mapping table (N:M relationship)
CREATE TABLE IF NOT EXISTS public.element_category_map (
  "id" uuid default gen_random_uuid() not null,
  "element_id" uuid not null,
  "category_id" uuid not null,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid,
  UNIQUE("element_id", "category_id")
);
ALTER TABLE public.element_category_map OWNER TO postgres;
-- Create supply table (XRF scan results from mine to refinery)
CREATE TABLE IF NOT EXISTS public.supply (
  "id" uuid default gen_random_uuid() not null,
  "external_supply_id" text not null, -- External supply ID: Reading No from XRF or barcode from Argor-Heraeus
  "external_reference_id" text, -- e.g. a batch number from the customer
  "declared_origin_id" uuid not null,
  "predicted_origin_id" uuid,
  "scan_date" timestamptz,
  "confidence_score" numeric CHECK ("confidence_score" >= 0 AND "confidence_score" <= 1),
  "notes" text,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.supply OWNER TO postgres;
-- Set REPLICA IDENTITY to FULL so we get the old values in DELETE events
ALTER TABLE public.supply REPLICA IDENTITY FULL;
-- Add supply table to the supabase_realtime publication
-- This enables postgres_changes events for INSERT, UPDATE, DELETE
ALTER PUBLICATION supabase_realtime ADD TABLE public.supply;
-- Add a comment to document this
COMMENT ON TABLE public.supply IS 'Supply data with XRF measurements. Realtime enabled for live prediction updates.';
-- Create measurement_status table (for supply_elements status lookup)
CREATE TABLE IF NOT EXISTS public.measurement_status (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null unique,
  "description" text,
  "is_default" boolean default false,
  "is_active" boolean default true,
  "sort_order" integer default 0,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.measurement_status OWNER TO postgres;
-- Create measurement_units table (for supply_elements unit lookup)
CREATE TABLE IF NOT EXISTS public.measurement_units (
  "id" uuid default gen_random_uuid() not null,
  "symbol" text not null unique,
  "name" text not null,
  "description" text,
  "is_default" boolean default false,
  "is_active" boolean default true,
  "sort_order" integer default 0,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.measurement_units OWNER TO postgres;
-- Create supply_elements junction table (element measurements per supply)
CREATE TABLE IF NOT EXISTS public.supply_elements (
  "id" uuid default gen_random_uuid() not null,
  "supply_id" uuid not null,
  "status_id" uuid, -- TODO measurement status, maybe wrong here , should probably be on supply
  "element_id" uuid not null,
  "concentration" numeric not null,
  "unit_id" uuid not null,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.supply_elements OWNER TO postgres;
-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.customers OWNER TO postgres;
-- Create customer_origins mapping table (many-to-many)
CREATE TABLE IF NOT EXISTS public.customer_origins (
  "id" uuid default gen_random_uuid() not null,
  "customer_id" uuid not null,
  "origin_id" uuid not null,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid,
  UNIQUE("customer_id", "origin_id")
);
ALTER TABLE public.customer_origins OWNER TO postgres;
-- Create origin_id_mapping table (for external ID mappings)
CREATE TABLE IF NOT EXISTS public.origin_id_mapping (
  "id" uuid default gen_random_uuid() not null,
  "declared_origin_code" text not null,
  "external_id" text not null,
  "batch" text,
  "alternate_id" text,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.origin_id_mapping OWNER TO postgres;
-- Add foreign key constraint to origins table
ALTER TABLE public.origin_id_mapping
  ADD CONSTRAINT "origin_id_mapping_declared_origin_code_fkey"
  FOREIGN KEY ("declared_origin_code")
  REFERENCES public.origins("code")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
COMMENT ON CONSTRAINT "origin_id_mapping_declared_origin_code_fkey" ON public.origin_id_mapping 
  IS 'Cascades delete when origin is removed';
-- Add unique constraint on external_id + declared_origin_code
ALTER TABLE public.origin_id_mapping 
  ADD CONSTRAINT "origin_id_mapping_external_id_code_unique" 
  UNIQUE ("external_id", "declared_origin_code");
COMMENT ON CONSTRAINT "origin_id_mapping_declared_origin_code_fkey" ON public.origin_id_mapping 
  IS 'Ensures declared_origin_code exists in origins table';
COMMENT ON TABLE public.origin_id_mapping IS 'Maps external IDs and batch numbers to origin codes';
COMMENT ON COLUMN public.origin_id_mapping."declared_origin_code" IS 'Origin code reference';
COMMENT ON COLUMN public.origin_id_mapping."external_id" IS 'External reference ID';
COMMENT ON COLUMN public.origin_id_mapping."batch" IS 'Batch number';
COMMENT ON COLUMN public.origin_id_mapping."alternate_id" IS 'Alternative ID';
-- ============================================
-- ALERT / NOTIFICATION TABLES
-- ============================================

-- Create alert_channel_types enum
DROP TYPE IF EXISTS public.alert_channel_type CASCADE;
CREATE TYPE public.alert_channel_type AS ENUM (
    'email',
    'teams',
    'slack',
    'whatsapp',
    'sms',
    'webhook'
);
ALTER TYPE public.alert_channel_type OWNER TO postgres;
CREATE TYPE public.alert_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);
ALTER TYPE public."alert_priority" OWNER TO postgres;
-- Create alert_channels table
CREATE TABLE IF NOT EXISTS public.alert_channels (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "type" public.alert_channel_type not null,
  "enabled" boolean default true,
  "min_priority" public.alert_priority default 'low',
  "config" jsonb not null, -- Stores type-specific configuration (email address, webhook URL, etc.)
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.alert_channels OWNER TO postgres;
-- Create alert_conditions table (for chemistry-based alerts)
CREATE TABLE IF NOT EXISTS public.alert_conditions (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "description" text,
  "element_id" uuid not null,
  "operator" text not null check ("operator" IN ('>', '<', '>=', '<=', '=', '!=')),
  "threshold_value" numeric not null,
  "priority" public."alert_priority" default 'medium',
  "enabled" boolean default true,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "created_by" uuid,
  "updated_by" uuid
);
ALTER TABLE public.alert_conditions OWNER TO postgres;
-- Create junction table for many-to-many relationship between conditions and channels
CREATE TABLE IF NOT EXISTS public.alert_condition_channels (
  "id" uuid default gen_random_uuid() not null,
  "alert_condition_id" uuid not null,
  "alert_channel_id" uuid not null,
  "created_at" timestamptz default now(),
  UNIQUE ("alert_condition_id", "alert_channel_id")
);
ALTER TABLE public.alert_condition_channels OWNER TO postgres;
-- Create alert_logs table (history of triggered alerts)
CREATE TABLE IF NOT EXISTS public.alert_logs (
  "id" uuid default gen_random_uuid() not null,
  "alert_condition_id" uuid,
  "supply_id" uuid,
  "channel_id" uuid,
  "priority" public.alert_priority not null,
  "message" text not null,
  "metadata" jsonb,
  "sent_at" timestamptz default now(),
  "status" text default 'sent' CHECK ("status" IN ('sent', 'failed', 'pending')),
  "error_message" text,
  "created_at" timestamptz default now()
);
ALTER TABLE public.alert_logs OWNER TO postgres;
-- ============================================
-- SYSTEM SETTINGS TABLES
-- ============================================

-- Create system_settings table (key-value configuration store)
CREATE TABLE IF NOT EXISTS public.system_settings (
  "id" uuid default gen_random_uuid() not null,
  "key" text not null unique,
  "value" text not null,
  "value_type" text not null check ("value_type" IN ('string', 'number', 'boolean', 'json')),
  "category" text not null check ("category" IN ('system', 'email', 'neural_network', 'backup', 'security')),
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
ALTER TABLE ONLY public.country ADD CONSTRAINT "country_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.origins ADD CONSTRAINT "origins_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.elements ADD CONSTRAINT "elements_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.element_categories ADD CONSTRAINT "element_categories_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.element_category_map ADD CONSTRAINT "element_category_map_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.supply ADD CONSTRAINT "supply_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.measurement_status ADD CONSTRAINT "measurement_status_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.measurement_units ADD CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.supply_elements ADD CONSTRAINT "supply_elements_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.customers ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.customer_origins ADD CONSTRAINT "customer_origins_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.origin_id_mapping ADD CONSTRAINT "origin_id_mapping_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.alert_channels ADD CONSTRAINT "alert_channels_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.alert_conditions ADD CONSTRAINT "alert_conditions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.alert_condition_channels ADD CONSTRAINT "alert_condition_channels_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.alert_logs ADD CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public.system_settings ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");
-- ============================================
-- FOREIGN KEYS
-- ============================================

-- User-related foreign keys
ALTER TABLE ONLY public.profile 
  ADD CONSTRAINT "profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles 
  ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
-- Project and sample foreign keys
-- Supply chain foreign keys
ALTER TABLE ONLY public.origins
  ADD CONSTRAINT "origins_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES public.country("id") ON DELETE SET NULL;
ALTER TABLE ONLY public.element_category_map 
  ADD CONSTRAINT "element_category_map_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES public.elements("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.element_category_map 
  ADD CONSTRAINT "element_category_map_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES public.element_categories("id") ON DELETE CASCADE;
ALTER TABLE public.supply
  ADD CONSTRAINT "supply_declared_origin_id_fkey"
  FOREIGN KEY ("declared_origin_id")
  REFERENCES public.origins("id")
  ON DELETE CASCADE;
ALTER TABLE ONLY public.supply 
  ADD CONSTRAINT "supply_predicted_origin_id_fkey" FOREIGN KEY ("predicted_origin_id") REFERENCES public.origins("id") ON DELETE SET NULL;
ALTER TABLE ONLY public.supply_elements 
  ADD CONSTRAINT "supply_elements_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES public.supply("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.supply_elements 
  ADD CONSTRAINT "supply_elements_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES public.elements("id") ON DELETE RESTRICT;
ALTER TABLE ONLY public.supply_elements 
  ADD CONSTRAINT "supply_elements_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES public."measurement_status"("id") ON DELETE RESTRICT;
ALTER TABLE ONLY public.supply_elements 
  ADD CONSTRAINT "supply_elements_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES public."measurement_units"("id") ON DELETE RESTRICT;
-- Customer-origin foreign keys
ALTER TABLE ONLY public.customer_origins 
  ADD CONSTRAINT "customer_origins_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES public."customers"("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.customer_origins 
  ADD CONSTRAINT "customer_origins_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES public."origins"("id") ON DELETE CASCADE;
-- Alert foreign keys
ALTER TABLE ONLY public.alert_conditions 
  ADD CONSTRAINT "alert_conditions_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES public."elements"("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.alert_condition_channels
  ADD CONSTRAINT "alert_condition_channels_condition_id_fkey" FOREIGN KEY ("alert_condition_id") REFERENCES public."alert_conditions"("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.alert_condition_channels 
  ADD CONSTRAINT "alert_condition_channels_channel_id_fkey" FOREIGN KEY ("alert_channel_id") REFERENCES public."alert_channels"("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.alert_logs 
  ADD CONSTRAINT "alert_logs_alert_condition_id_fkey" FOREIGN KEY ("alert_condition_id") REFERENCES public."alert_conditions"("id") ON DELETE SET NULL;
ALTER TABLE ONLY public.alert_logs 
  ADD CONSTRAINT "alert_logs_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES public."supply"("id") ON DELETE CASCADE;
ALTER TABLE ONLY public.alert_logs 
  ADD CONSTRAINT "alert_logs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES public."alert_channels"("id") ON DELETE SET NULL;
-- ============================================
-- ML MODELS TABLE
-- Stores trained neural network models with complete reproducibility snapshots
-- ============================================

CREATE TABLE IF NOT EXISTS public.models (
  -- ============================================================================
  -- Primary Identity
  -- ============================================================================
  "id" UUID default gen_random_uuid() not null,
  "model_name" text not null,
  "model_version" text not null default 'v1.0.0',
  
  -- ============================================================================
  -- SNAPSHOT: Training Hyperparameters (immutable, at training time)
  -- These values NEVER change after training - ensures reproducibility
  -- ============================================================================
  "epochs" integer not null,
  "batch_size" integer not null,
  "learning_rate" double precision not null default 0.001,
  "dropout_rate" double precision not null default 0.3,
  "validation_split" double precision not null default 0.2,
  "optimizer" text not null default 'adam',
  
  -- ============================================================================
  -- SNAPSHOT: Model Architecture (at training time)
  -- Complete layer configuration as JSON
  -- ============================================================================
  "architecture" jsonb not null,
  
  -- ============================================================================
  -- SNAPSHOT: Data Filters Used (at training time)
  -- Records EXACTLY what data selection criteria were used
  -- ============================================================================
  "data_filters" jsonb,
  
  -- ============================================================================
  -- SNAPSHOT: Complete System Settings (at training time)
  -- Full copy of all ML-related system_settings for complete reproducibility
  -- ============================================================================
  "settings_snapshot" jsonb not null,
  
  -- ============================================================================
  -- Settings Metadata
  -- ============================================================================
  "settings_source" text default 'system_settings' CHECK (
    "settings_source" IN ('system_settings', 'api_override', 'grid_search', 'custom')
  ),
  "settings_drift_detected" BOOLEAN default false,
  
  -- ============================================================================
  -- Training Results & Metrics
  -- ============================================================================
  "training_timestamp" timestamptz default now() not null,
  "training_samples" int not null,
  "training_accuracy" double precision not null,
  "validation_accuracy" double precision,
  "training_duration_seconds" int,
  "training_loss" double precision,
  "validation_loss" double precision,
  
  -- ============================================================================
  -- Elements & Origins Coverage
  -- Tracks which features and labels the model knows
  -- ============================================================================
  "elements_used" text[] not null,
  "origins_covered" text[] not null,
  "unique_origins_count" int not null,
  
  -- ============================================================================
  -- Model Binary Storage (NEW - replaces file paths)
  -- Direct storage of serialized model artifacts as binary data
  -- Size: ~137 KB total (0.013% of 1GB PostgreSQL bytea limit)
  -- ============================================================================
  "model_binary" bytea,              -- Keras model (.keras format) ~134 KB
  "scaler_binary" bytea,             -- StandardScaler (pickle) ~1.6 KB
  "label_encoder_binary" bytea,     -- LabelEncoder (pickle) ~2 KB
  "model_size_bytes" bigint,         -- Total size for monitoring
  
  -- ============================================================================
  -- Deployment & Status
  -- ============================================================================
  "status" text default 'trained' not null check (
    "status" IN ('training', 'trained', 'deployed', 'archived', 'failed')
  ),
  "is_active" BOOLEAN default false not null,
  "deployed_at" timestamptz,
  "deployed_by" text,
  "archived_at" timestamptz,
  "archived_reason" text,
  
  -- ============================================================================
  -- Metadata & Documentation
  -- ============================================================================
  "description" text,
  "tags" text[],
  "training_notes" text,
  
  -- ============================================================================
  -- Audit Fields
  -- ============================================================================
  "created_by" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  
  -- ============================================================================
  -- Constraints
  -- ============================================================================
  CONSTRAINT "models_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "models_name_version_unique" UNIQUE ("model_name", "model_version"),
  CONSTRAINT "models_accuracy_range" CHECK ("training_accuracy" >= 0 AND "training_accuracy" <= 1),
  CONSTRAINT "models_validation_accuracy_range" CHECK ("validation_accuracy" IS NULL OR ("validation_accuracy" >= 0 AND "validation_accuracy" <= 1))
);
ALTER TABLE public.models OWNER TO postgres;
COMMENT ON TABLE public.models IS 'Stores trained ML models with complete reproducibility snapshots. All hyperparameters, data filters, and settings are immutable after training.';
COMMENT ON COLUMN public.models."settings_snapshot" IS 'Complete copy of all system_settings at training time. Ensures exact reproducibility.';
COMMENT ON COLUMN public.models."data_filters" IS 'jsonb snapshot of data selection criteria used during training.';
COMMENT ON COLUMN public.models."settings_drift_detected" IS 'Auto-calculated: true if current system_settings differ from settings_snapshot.';
COMMENT ON COLUMN public.models."is_active" IS 'Only ONE model can be active at a time (enforced by unique constraint).';
COMMENT ON COLUMN public.models."architecture" IS 'Model architecture as JSON: layer sizes, activations, etc.';
-- Add comments for documentation
COMMENT ON TABLE public.system_settings IS 'System-wide configuration settings for the application';
COMMENT ON COLUMN public.system_settings.key IS 'Unique setting identifier in dot notation (e.g., ml.auto_predict_enabled)';
COMMENT ON COLUMN public.system_settings.category IS 'Setting category for grouping (e.g., neural_network, general, ui)';
-- ============================================
-- Migration: Create Prediction Results Table
-- ============================================
-- This table stores all top-N predictions for each supply,
-- allowing users to view prediction details even for batch predictions

CREATE TABLE IF NOT EXISTS public.prediction_results (
  "id" uuid default gen_random_uuid() not null,
  "supply_id" uuid not null,
  "origin_id" uuid not null,
  "confidence_score" numeric not null check ("confidence_score" >= 0 AND "confidence_score" <= 1),
  "rank" integer not null check ("rank" >= 1),
  "model_id" text, -- ML Server model ID used for prediction
  "created_at" timestamptz default now(),
  CONSTRAINT "prediction_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prediction_results_supply_rank_unique" UNIQUE ("supply_id", "rank")
);
ALTER TABLE public.prediction_results OWNER TO postgres;
-- Add foreign keys
ALTER TABLE ONLY public.prediction_results
  ADD CONSTRAINT "prediction_results_supply_id_fkey" 
  FOREIGN KEY ("supply_id") 
  REFERENCES public."supply"("id") 
  ON DELETE CASCADE;
ALTER TABLE ONLY public.prediction_results
  ADD CONSTRAINT "prediction_results_origin_id_fkey" 
  FOREIGN KEY ("origin_id") 
  REFERENCES public."origins"("id") 
  ON DELETE CASCADE;
-- Comments
COMMENT ON TABLE public.prediction_results IS 'Stores all top-N predictions for each supply from ML model';
COMMENT ON COLUMN public.prediction_results.supply_id IS 'Reference to the supply that was predicted';
COMMENT ON COLUMN public.prediction_results.origin_id IS 'Predicted origin';
COMMENT ON COLUMN public.prediction_results.confidence_score IS 'Confidence/probability of this prediction (0-1)';
COMMENT ON COLUMN public.prediction_results.rank IS 'Rank of this prediction (1=best, 2=second best, etc.)';
COMMENT ON COLUMN public.prediction_results.model_id IS 'ML Server model ID that generated this prediction';
-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid default gen_random_uuid() PRIMARY KEY,
  name text not null unique,
  description text,
  category text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE public.permissions OWNER TO postgres;
COMMENT ON TABLE public.permissions IS 'System permissions for RBAC';
COMMENT ON COLUMN public.permissions.name IS 'Permission identifier (e.g., production.view, settings.neural_network.manage)';
COMMENT ON COLUMN public.permissions.category IS 'Permission category (e.g., production, settings, analytics)';
-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid default gen_random_uuid() PRIMARY KEY,
  role public.app_role not null,
  permission_id uuid not null REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz default now(),
  UNIQUE(role, permission_id)
);
ALTER TABLE public.role_permissions OWNER TO postgres;
COMMENT ON TABLE public.role_permissions IS 'Maps roles to their permissions';
-- Add comments to document the new structure
COMMENT ON TABLE public.element_categories IS 'Element categories (e.g., Metallic composites, Trace elements, Deleterious elements)';
COMMENT ON TABLE public.element_category_map IS 'N:M mapping between elements and categories - allows elements to belong to multiple categories';
-- ============================================
-- Migration: Auto Prediction Jobs Table
-- ============================================
-- This table tracks automatic prediction jobs triggered during CSV import.
-- Jobs persist across page navigation, allowing users to leave and return
-- to see progress updates.

CREATE TABLE IF NOT EXISTS public.auto_prediction_jobs (
  "id" uuid default gen_random_uuid() not null primary key,
  "model_id" text not null,
  "supply_ids" uuid[] not null,
  "status" text not null check (status in ('pending', 'running', 'completed', 'failed', 'timeout')),
  "total_count" integer not null,
  "completed_count" integer default 0 not null,
  "successful_count" integer default 0 not null,
  "failed_count" integer default 0 not null,
  "current_status_message" text,
  "error_message" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "completed_at" timestamptz
);
-- Comments for documentation
COMMENT ON TABLE public.auto_prediction_jobs IS 'Tracks automatic origin prediction jobs triggered during CSV import';
COMMENT ON COLUMN public.auto_prediction_jobs.supply_ids IS 'Array of supply UUIDs to predict origins for';
COMMENT ON COLUMN public.auto_prediction_jobs.status IS 'Job status: pending, running, completed, failed, timeout';
COMMENT ON COLUMN public.auto_prediction_jobs.total_count IS 'Total number of supplies to predict';
COMMENT ON COLUMN public.auto_prediction_jobs.completed_count IS 'Number of predictions attempted (success + failed)';
COMMENT ON COLUMN public.auto_prediction_jobs.successful_count IS 'Number of successful predictions';
COMMENT ON COLUMN public.auto_prediction_jobs.failed_count IS 'Number of failed predictions';
COMMENT ON COLUMN public.auto_prediction_jobs.current_status_message IS 'Human-readable status message for UI display';

-- ============================================
-- xChat Shared Conversation Tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  company_name text,
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message text NOT NULL DEFAULT 'No messages yet',
  last_message_at timestamptz
);
ALTER TABLE public.chat_conversations OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.chat_conversation_members (
  conversation_id text NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  member_email text NOT NULL,
  display_name text,
  member_role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, member_email)
);
ALTER TABLE public.chat_conversation_members OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text PRIMARY KEY,
  chat_id text NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  content text NOT NULL,
  sender text NOT NULL,
  sender_email text NOT NULL,
  timestamp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  is_mine boolean NOT NULL DEFAULT false,
  is_macro boolean NOT NULL DEFAULT false,
  quote_request_id text
);
ALTER TABLE public.chat_messages OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id text PRIMARY KEY,
  chat_id text NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  source_message_id text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  requested_by text NOT NULL,
  requested_by_email text NOT NULL,
  requested_from text NOT NULL,
  created_at timestamptz NOT NULL,
  response_deadline timestamptz,
  terms jsonb NOT NULL
);
ALTER TABLE public.quote_requests OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.quote_responses (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  parent_response_id text,
  version integer NOT NULL,
  responder text NOT NULL,
  responder_email text NOT NULL,
  created_at timestamptz NOT NULL,
  status text NOT NULL,
  quoted_premium text,
  notes text
);
ALTER TABLE public.quote_responses OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.trade_deals (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  response_id text,
  response_version integer,
  counterparty text NOT NULL,
  booked_by_email text,
  product text NOT NULL,
  volume text NOT NULL,
  created_at timestamptz NOT NULL,
  status text NOT NULL,
  terms jsonb NOT NULL
);
ALTER TABLE public.trade_deals OWNER TO postgres;
