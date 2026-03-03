-- Migration: Bulk Branch Config RPC
-- Date: 2026-03-03
-- Purpose: Allow admin to assign inventory deadlines to multiple branches at once

CREATE OR REPLACE FUNCTION save_bulk_branch_config(
  p_branch_names text[],
  p_days integer,
  p_start_date_seconds numeric DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_branch_name text;
BEGIN
  FOREACH v_branch_name IN ARRAY p_branch_names
  LOOP
    -- Upsert CONFIG_DAYS
    INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status)
    VALUES (v_branch_name, '_CONFIG_', 'CONFIG_DAYS', p_days, 0, 'pending')
    ON CONFLICT (branch_name, laboratory, ean) 
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

    -- Upsert CONFIG_START_DATE (if provided)
    IF p_start_date_seconds IS NOT NULL THEN
      INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status)
      VALUES (v_branch_name, '_CONFIG_', 'CONFIG_START_DATE', p_start_date_seconds, 0, 'pending')
      ON CONFLICT (branch_name, laboratory, ean) 
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_bulk_branch_config TO anon, authenticated;

COMMENT ON FUNCTION save_bulk_branch_config IS 'Asignación masiva de plazos de inventario para múltiples sucursales.';
