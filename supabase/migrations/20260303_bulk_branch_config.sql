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
  v_clean_branch text;
BEGIN
  -- Ensure CONFIG products exist
  INSERT INTO public.products (ean, name, category, laboratory, cost)
  VALUES 
      ('CONFIG_DAYS', 'Configuración: Días del Ciclo', 'SISTEMA', '_CONFIG_', 0),
      ('CONFIG_START_DATE', 'Configuración: Fecha de Inicio', 'SISTEMA', '_CONFIG_', 0)
  ON CONFLICT (ean) DO NOTHING;

  FOREACH v_branch_name IN ARRAY p_branch_names
  LOOP
    -- Normalización consistente
    v_clean_branch := UPPER(TRIM(TRANSLATE(v_branch_name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')));

    -- Upsert CONFIG_DAYS
    INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, updated_at)
    VALUES (v_clean_branch, '_CONFIG_', 'CONFIG_DAYS', p_days, 0, 'pending', 'SISTEMA', NOW())
    ON CONFLICT (branch_name, laboratory, ean) 
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

    -- Upsert CONFIG_START_DATE (if provided)
    IF p_start_date_seconds IS NOT NULL THEN
      INSERT INTO public.inventories (branch_name, laboratory, ean, quantity, system_quantity, status, category, updated_at)
      VALUES (v_clean_branch, '_CONFIG_', 'CONFIG_START_DATE', p_start_date_seconds, 0, 'pending', 'SISTEMA', NOW())
      ON CONFLICT (branch_name, laboratory, ean) 
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_bulk_branch_config TO anon, authenticated;

COMMENT ON FUNCTION save_bulk_branch_config IS 'Asignación masiva de plazos de inventario para múltiples sucursales.';
