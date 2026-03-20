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
